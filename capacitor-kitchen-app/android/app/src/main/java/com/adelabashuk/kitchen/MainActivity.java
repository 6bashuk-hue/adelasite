package com.adelabashuk.kitchen;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Local (non-npm) plugins aren't auto-discovered by Capacitor — must register
        // them manually, before super.onCreate().
        registerPlugin(UsbThermalPrinterPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
