package com.example.shared.correlation;

public final class CorrelationId {

    public static final String HEADER = "X-Correlation-ID";
    public static final String MDC_KEY = "correlationId";
    public static final String REQUEST_ATTRIBUTE = "X-Correlation-ID";

    private CorrelationId() {}

    public static String get() {
        String id = CorrelationIdHolder.get();
        if (id != null) {
            return id;
        }
        return org.slf4j.MDC.get(MDC_KEY);
    }
}
