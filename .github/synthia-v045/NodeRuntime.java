package world.synthia.r2116;

public final class NodeRuntime {
    private NodeRuntime() {}
    static {
        System.loadLibrary("node");
        System.loadLibrary("synthia-jni");
    }
    public static native int startNodeWithArguments(String[] arguments);
}
