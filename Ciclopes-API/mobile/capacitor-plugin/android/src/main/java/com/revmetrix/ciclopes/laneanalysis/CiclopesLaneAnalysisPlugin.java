package com.revmetrix.ciclopes.laneanalysis;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "CiclopesLaneAnalysis")
public final class CiclopesLaneAnalysisPlugin extends Plugin {

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", false);
        result.put("reason", "The Android ONNX Runtime session has not been implemented yet.");
        call.resolve(result);
    }

    @PluginMethod
    public void analyzeFrame(PluginCall call) {
        String frameUri = call.getString("frameUri");
        if (frameUri == null || frameUri.trim().isEmpty()) {
            call.reject("frameUri is required.");
            return;
        }
        call.reject("Android frame decoding and ONNX inference are not implemented yet.");
    }

    @PluginMethod
    public void applyLaneCorrection(PluginCall call) {
        call.reject("Applying corrected lane geometry is not implemented yet.");
    }

    @PluginMethod
    public void release(PluginCall call) {
        call.resolve();
    }
}
