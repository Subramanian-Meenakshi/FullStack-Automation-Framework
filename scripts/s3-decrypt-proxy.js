#!/usr/bin/env node
/**
 * s3-decrypt-proxy.js — display-only decryption proxy for localstack-explorer.
 *
 * Forwards every request unchanged to LocalStack; the ONLY transformation is
 * on GET response bodies for display: AES-256-GCM objects
 * (layout iv(12) || tag(16) || ciphertext, same key as employee-consumer)
 * are decrypted in flight so the explorer preview shows plaintext.
 * Bytes stored in S3 are never touched; producer/consumer unchanged.
 *
 * Start: node scripts/s3-decrypt-proxy.js   (port 4567, see S3_GUI_PROXY_PORT)
 * Point explorer endpoint at: http://localhost:4567
 */
'use strict';

const http = require('http');
const crypto = require('crypto');

const LISTEN_PORT = Number(process.env.S3_GUI_PROXY_PORT || 4567);
const TARGET = process.env.S3_GUI_PROXY_TARGET || 'http://localhost:4566';
const KEY_B64 = process.env.S3_DEC_KEY_B64 || 'GghACJLOTOVwBDBAcYc7fvrfB9XPcB9nuNuMBWTgsQo=';
const IV_LEN = 12;
const TAG_LEN = 16;
const MAX_DECRYPT_BYTES = 5 * 1024 * 1024; // employee JSONs are KBs; bigger = stream untouched

const key = Buffer.from(KEY_B64, 'base64');
if (key.length !== 32) {
  console.error(`[s3-proxy] S3_DEC_KEY_B64 must decode to 32 bytes, got ${key.length}`);
  process.exit(1);
}

/** @returns {Buffer|null} plaintext, or null when body is not a valid GCM object */
function tryDecrypt(buf) {
  if (buf.length <= IV_LEN + TAG_LEN) return null;
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const body = buf.subarray(IV_LEN + TAG_LEN);
  try {
    const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(body), d.final()]); // final() throws on auth-tag mismatch
  } catch {
    return null; // not encrypted (or wrong key) -> passthrough untouched
  }
}

function copyHeaders(src, drop = []) {
  const out = {};
  for (const [k, v] of Object.entries(src)) {
    if (!drop.includes(k.toLowerCase())) out[k] = v;
  }
  return out;
}

const server = http.createServer((req, res) => {
  const targetUrl = new URL(req.url, TARGET);
  const headers = copyHeaders(req.headers, ['host']);
  headers.host = targetUrl.host;

  const proxyReq = http.request(
    targetUrl,
    { method: req.method, headers },
    (proxyRes) => {
      const status = proxyRes.statusCode;
      const encoding = proxyRes.headers['content-encoding'];
      // aws-chunked is a payload-trailer marker LocalStack leaves on PUT objects,
      // not compression — body is still raw bytes, safe to attempt decrypt.
      const compressed = !!encoding && encoding !== 'aws-chunked';
      const len = Number(proxyRes.headers['content-length'] || 0);
      if (req.method === 'GET' && process.env.S3_GUI_PROXY_DEBUG) {
        console.log(
          `[s3-proxy] GET ${req.url} status=${status} len=${len} encoding=${encoding || '-'} te=${proxyRes.headers['transfer-encoding'] || '-'} attempt-pending`
        );
      }
      const canAttempt =
        (req.method === 'GET' && (status === 200 || status === 206)) &&
        !compressed &&
        len > 0 &&
        len <= MAX_DECRYPT_BYTES;

      if (!canAttempt) {
        // untouched passthrough (listings, HEAD, uploads, compressed, big objects)
        const rh = copyHeaders(proxyRes.headers);
        delete rh['transfer-encoding'];
        if (len > 0) rh['content-length'] = String(len);
        res.writeHead(status, rh);
        proxyRes.pipe(res);
        return;
      }

      const chunks = [];
      proxyRes.on('data', (c) => chunks.push(c));
      proxyRes.on('end', () => {
        const raw = Buffer.concat(chunks);
        const plain = tryDecrypt(raw);
        if (process.env.S3_GUI_PROXY_DEBUG) {
          console.log(`[s3-proxy] GET ${req.url} -> ${plain ? 'DECRYPTED' : 'passthrough'} (${raw.length}b)`);
        }
        if (plain) {
          const rh = copyHeaders(proxyRes.headers, [
            'content-length',
            'transfer-encoding',
            'content-md5',
            'content-range',
            'content-encoding',
          ]);
          rh['content-length'] = String(plain.length);
          rh['x-decrypted-display'] = 'aes-256-gcm'; // display-path marker, not stored anywhere
          res.writeHead(200, rh); // full decrypted body: Range honored as 200-OK full content
          res.end(plain);
        } else {
          // not a GCM object (plaintext upload, XML, etc.) -> original bytes
          const rh = copyHeaders(proxyRes.headers, ['transfer-encoding']);
          rh['content-length'] = String(raw.length);
          res.writeHead(status, rh);
          res.end(raw);
        }
      });
      proxyRes.on('error', () => {
        res.writeHead(502);
        res.end('upstream response error');
      });
    }
  );

  proxyReq.on('error', (err) => {
    res.writeHead(502, { 'content-type': 'text/plain' });
    res.end(`s3-proxy: upstream ${TARGET} unreachable: ${err.message}`);
  });

  req.pipe(proxyReq);
});

server.listen(LISTEN_PORT, () => {
  console.log(
    `[s3-proxy] display-only decrypt proxy on http://localhost:${LISTEN_PORT} -> ${TARGET} (key ${KEY_B64.slice(0, 6)}...)`
  );
});
