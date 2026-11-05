package com.example.shared.correlation;

public final class CorrelationIdHolder {

    private static final ThreadLocal<String> HOLDER = new ThreadLocal<>();

    private CorrelationIdHolder() {}

    public static void set(String correlationId) {
        HOLDER.set(correlationId);
    }

    public static String get() {
        return HOLDER.get();
    }

    public static void clear() {
        HOLDER.remove();
    }
}
