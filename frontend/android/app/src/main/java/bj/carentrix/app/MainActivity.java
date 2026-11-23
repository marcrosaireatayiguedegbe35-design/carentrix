package bj.carentrix.app;

import android.os.Bundle;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    // Installe l'ecran de demarrage compat (theme AppTheme.NoActionBarLaunch) :
    // fond uni sans icone, le vrai logo carre est affiche juste apres par le
    // plugin JS Capacitor SplashScreen (jamais masque en cercle, lui).
    SplashScreen.installSplashScreen(this);
    super.onCreate(savedInstanceState);
  }
}
