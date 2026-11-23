package io.github.segneur.gtracker;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Autorisations qui ne passent pas par une demande système ordinaire
 * (src/platform/permissions.ts) : la batterie « sans restriction » et le
 * démarrage automatique ; et le réglage de la localisation d'Android, coupée
 * pendant un enregistrement. La position et les notifications sont demandées
 * par le greffon du GPS, le Bluetooth par celui de la ceinture.
 *
 * Batterie : l'état se lit sans permission (isIgnoringBatteryOptimizations) ;
 * pour le changer, la page de Gtracker dans les réglages d'Android, d'où
 * « Batterie » mène à « Aucune restriction ». Pas de demande directe
 * (fenêtre « Autoriser ? ») : elle exige au manifeste une permission que
 * Google Play refuse à une application de sport.
 *
 * Démarrage automatique : propre à MIUI et HyperOS, sans interface standard.
 * On ouvre leur écran s'il existe, sinon les réglages de l'application. Son
 * état ne se lit pas (la lecture annonçait « désactivé » à tort) ; la marque
 * du téléphone suffit à la page pour cacher la ligne hors de Xiaomi.
 */
@CapacitorPlugin(name = "Permissions")
public class PermissionsPlugin extends Plugin {

    /** Vrai si l'application échappe à l'optimisation de la batterie (« Aucune restriction »). */
    @PluginMethod
    public void batteryStatus(PluginCall call) {
        PowerManager power = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        JSObject ret = new JSObject();
        ret.put("unrestricted", power != null && power.isIgnoringBatteryOptimizations(getContext().getPackageName()));
        call.resolve(ret);
    }

    /**
     * Ouvre la page de Gtracker dans les réglages d'Android (Batterie, puis « Aucune restriction ») ; à défaut, la
     * liste des applications et de leur batterie. Aucun de ces écrans ne rend de résultat : la méthode rend la main
     * aussitôt, et la page relit l'état au retour dans l'application.
     */
    @PluginMethod
    public void requestUnrestrictedBattery(PluginCall call) {
        if (start(appSettings()) || start(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))) call.resolve();
        else call.reject("Réglages de la batterie introuvables");
    }

    /** Marque du téléphone : la page ne montre la ligne du démarrage automatique que sur un Xiaomi. */
    @PluginMethod
    public void deviceBrand(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("manufacturer", Build.MANUFACTURER == null ? "" : Build.MANUFACTURER);
        ret.put("brand", Build.BRAND == null ? "" : Build.BRAND);
        call.resolve(ret);
    }

    /** Ouvre l'écran du démarrage automatique de MIUI / HyperOS, sinon les réglages de l'application. */
    @PluginMethod
    public void openAutostart(PluginCall call) {
        Intent miui = new Intent();
        miui.setComponent(new ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"));
        if (start(miui) || start(appSettings())) call.resolve();
        else call.reject("Réglages de l'application introuvables");
    }

    /** Ouvre le réglage de la localisation d'Android : « Activer la localisation » d'Enregistrer, quand elle est coupée. */
    @PluginMethod
    public void openLocationSettings(PluginCall call) {
        if (start(new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS))) call.resolve();
        else call.reject("Réglage de la localisation introuvable");
    }

    /** Ouvre les réglages de l'application : une autorisation refusée s'y rend. */
    @PluginMethod
    public void openAppSettings(PluginCall call) {
        if (start(appSettings())) call.resolve();
        else call.reject("Réglages de l'application introuvables");
    }

    private Uri packageUri() {
        return Uri.parse("package:" + getContext().getPackageName());
    }

    private Intent appSettings() {
        return new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, packageUri());
    }

    /** Lance l'écran ; faux s'il n'existe pas ou s'il est refusé. */
    private boolean start(Intent intent) {
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
