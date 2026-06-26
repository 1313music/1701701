package xyz.w1701701.android;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ShareCardSaverPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
