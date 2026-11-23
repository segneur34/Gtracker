import { describe, expect, it } from 'vitest';

/**
 * Le manifeste Android : ni sauvegarde Google ni transfert d'appareil, le dossier mémoire est la seule
 * sauvegarde ; le service de l'enregistrement et ses autorisations déclarés ici, sans compter sur le manifeste d'un
 * greffon ; rien qui démarre avec le téléphone ; rien que Google Play refuse (exemption de batterie, accès au réseau
 * local avant la cible 37) ; ni adresse ni nom de la ceinture dans le journal.
 */

// Les types de Node ne sont pas ceux de l'app (voir `hooks/mediaQueries.test.ts`) : le peu qui sert est décrit à la main.
interface Fs {
  existsSync(file: URL): boolean;
  readFileSync(file: URL, encoding: 'utf8'): string;
}
const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as Fs;

const repoFile = (path: string): string => fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

/** Commentaires XML retirés : un mot cité dans un commentaire ne prouve rien. */
const withoutComments = (xml: string): string => xml.replace(/<!--[\s\S]*?-->/g, '');
/** Commentaires Java retirés, pour la même raison. */
const withoutJavaComments = (java: string): string => java.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
const javaFile = (name: string): string => repoFile(`android/app/src/main/java/io/github/segneur/gtracker/${name}`);
const MANIFEST = withoutComments(repoFile('android/app/src/main/AndroidManifest.xml'));
/** Cible de l'application (`targetSdkVersion`), lue où Gradle la prend. */
const TARGET_SDK = Number(repoFile('android/variables.gradle').match(/\btargetSdkVersion\s*=\s*(\d+)/)?.[1]);
const RULES = withoutComments(repoFile('android/app/src/main/res/xml/data_extraction_rules.xml'));
/** Tous les emplacements que connaît `data-extraction-rules` (developer.android.com/identity/data/autobackup). */
const DOMAINS = ['root', 'file', 'database', 'sharedpref', 'external', 'device_root', 'device_file', 'device_database', 'device_sharedpref'];

/** Balise ouvrante qui contient `name`, attributs compris, avec son attribut `tools:node` éventuel. */
const tagWithName = (xml: string, tag: string, name: string): string | undefined =>
  xml.match(new RegExp(`<${tag}\\b[^>]*android:name="${name.replace(/\./g, '\\.')}"[^>]*>`))?.[0];

describe('manifeste Android : rien ne démarre avec le téléphone', () => {
  /** Une balise est hors du manifeste final si elle manque, ou si elle ne fait que retirer celle d'une bibliothèque. */
  const absentOrRemoved = (tag: string | undefined): boolean => tag === undefined || tag.includes('tools:node="remove"');

  it('aucune permission de démarrage', () => {
    expect(absentOrRemoved(tagWithName(MANIFEST, 'uses-permission', 'android.permission.RECEIVE_BOOT_COMPLETED'))).toBe(true);
  });

  it('aucun récepteur déclaré, hors ceux retirés à une bibliothèque', () => {
    const receivers = MANIFEST.match(/<receiver\b[^>]*>/g) ?? [];
    expect(receivers.filter((tag) => !absentOrRemoved(tag))).toEqual([]);
  });

  it("une balise qui retire a besoin de l'espace de noms tools", () => {
    if (MANIFEST.includes('tools:node=')) expect(MANIFEST).toContain('xmlns:tools="http://schemas.android.com/tools"');
  });
});

describe("manifeste Android : service de l'enregistrement", () => {
  const service = tagWithName(MANIFEST, 'service', '.RecordingService') ?? '';

  it('déclaré chez nous, fermé aux autres applications, de type position', () => {
    expect(service).toContain('android:exported="false"');
    expect(service).toContain('android:foregroundServiceType="location"');
  });

  it("balayer l'application hors des applications récentes ne l'arrête pas", () => {
    expect(service).toContain('android:stopWithTask="false"');
  });

  it('la classe déclarée existe, est un service, et Android ne la relance jamais seul', () => {
    const java = repoFile('android/app/src/main/java/io/github/segneur/gtracker/RecordingService.java');
    expect(java).toContain('public class RecordingService extends Service');
    expect(java).toContain('return START_NOT_STICKY;');
    expect(java).not.toMatch(/return START_(STICKY|REDELIVER_INTENT);/);
  });

  it.each(['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION', 'FOREGROUND_SERVICE', 'FOREGROUND_SERVICE_LOCATION'])(
    'déclare %s sans compter sur le manifeste d\'un greffon',
    (name) => {
      const tag = tagWithName(MANIFEST, 'uses-permission', `android.permission.${name}`);
      expect(tag).toBeDefined();
      expect(tag).not.toContain('tools:node');
    },
  );

  it('ne demande jamais la position « toujours » : le service ne démarre que depuis l\'application visible', () => {
    expect(MANIFEST).not.toContain('ACCESS_BACKGROUND_LOCATION');
  });

  it('un seul service déclaré ici', () => {
    expect(MANIFEST.match(/<service\b/g)).toHaveLength(1);
  });
});

describe('manifeste Android : ce qui reste', () => {
  it.each(['FOREGROUND_SERVICE', 'WAKE_LOCK', 'POST_NOTIFICATIONS'])("garde %s : service GPS et notification de l'enregistrement", (name) => {
    expect(tagWithName(MANIFEST, 'uses-permission', `android.permission.${name}`)).toBeDefined();
  });

  it('aucune exemption de batterie : ni la permission, ni la demande directe, que Google Play refuse au sport', () => {
    expect(MANIFEST).not.toContain('REQUEST_IGNORE_BATTERY_OPTIMIZATIONS');
    const plugin = withoutJavaComments(javaFile('PermissionsPlugin.java'));
    expect(plugin).not.toContain('ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS');
    expect(plugin).not.toContain('BatteryLife');
    // « Autoriser » ouvre la page de Gtracker dans Android, d'où Batterie mène à « Aucune restriction ».
    const request = plugin.match(/public void requestUnrestrictedBattery\(PluginCall call\) \{[\s\S]*?\n {4}\}/)?.[0] ?? '';
    expect(request).toMatch(/start\(appSettings\(\)\) \|\| start\(new Intent\(Settings\.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS\)\)/);
  });

  it("changer la taille ou la graisse du texte du téléphone ne recrée pas l'activité (enregistrement en cours)", () => {
    const changes = tagWithName(MANIFEST, 'activity', '.MainActivity')?.match(/android:configChanges="([^"]*)"/)?.[1].split('|') ?? [];
    expect(changes).toEqual(expect.arrayContaining(['fontScale', 'fontWeightAdjustment', 'orientation', 'screenSize', 'uiMode', 'density']));
  });
});

describe('manifeste Android : sauvegarde', () => {
  it('coupe la sauvegarde et pointe vers les règles', () => {
    expect(MANIFEST).toContain('android:allowBackup="false"');
    expect(MANIFEST).toContain('android:dataExtractionRules="@xml/data_extraction_rules"');
    expect(MANIFEST).not.toContain('android:allowBackup="true"');
  });

  it.each(['cloud-backup', 'device-transfer'])('%s : tout est exclu, rien n\'est inclus', (section) => {
    const body = RULES.match(new RegExp(`<${section}>([\\s\\S]*?)</${section}>`))?.[1];
    expect(body, section).toBeDefined();
    expect(body).not.toContain('<include');
    for (const domain of DOMAINS) expect(body, domain).toContain(`<exclude domain="${domain}" path="." />`);
  });
});

describe('manifeste Android : fichiers reçus d\'une autre application', () => {
  const activity = MANIFEST.match(/<activity\b[\s\S]*?<\/activity>/)?.[0] ?? '';
  const filters = [...activity.matchAll(/<intent-filter>([\s\S]*?)<\/intent-filter>/g)].map((m) => m[1]);
  const allWithAction = (action: string): string[] => filters.filter((f) => f.includes(`android.intent.action.${action}"`));
  const withAction = (action: string): string => allWithAction(action)[0] ?? '';
  /** Le filtre VIEW du « Ouvrir avec » par l'extension : le seul qui porte le type générique. */
  const extensionFilter = allWithAction('VIEW').find((f) => f.includes('android:mimeType="*/*"')) ?? '';
  /** Types précis du GPX et du FIT, les seuls de « Ouvrir avec ». */
  const TYPES = ['application/gpx+xml', 'application/gpx', 'application/vnd.ant.fit', 'application/fit'];
  /** Les types déclarés d'un filtre. */
  const typesOf = (filter: string): string[] => [...filter.matchAll(/android:mimeType="([^"]*)"/g)].map((m) => m[1]).sort();

  it('l\'activité reste seule de sa tâche, et le lanceur ne change pas : une ouverture normale reste la même', () => {
    expect(activity).toContain('android:launchMode="singleTask"');
    expect(withAction('MAIN')).toContain('android.intent.category.LAUNCHER');
  });

  it.each(['VIEW', 'SEND'])('%s : proposé sans lien depuis une page web, jamais pour du JSON', (action) => {
    const filter = withAction(action);
    expect(filter).toContain('android.intent.category.DEFAULT');
    expect(filter).not.toContain('BROWSABLE');
    expect(filter, 'json').not.toContain('json');
  });

  it('VIEW par type : les types précis du GPX et du FIT, sans binaire ni XML générique', () => {
    expect(typesOf(withAction('VIEW'))).toEqual([...TYPES].sort());
  });

  it('SEND : les mêmes, et application/octet-stream, seule forme sous laquelle un fichier de montre arrive par un partage', () => {
    expect(typesOf(withAction('SEND'))).toEqual([...TYPES, 'application/octet-stream'].sort());
  });

  it('aucun XML générique, nulle part : Gtracker ne se propose pas pour tout fichier XML', () => {
    expect(activity).not.toContain('android:mimeType="text/xml"');
    expect(activity).not.toContain('android:mimeType="application/xml"');
  });

  it('un seul filtre VIEW à type générique, borné aux extensions .gpx et .fit (Gtracker ne se propose pas pour tout)', () => {
    const generic = allWithAction('VIEW').filter((f) => f.includes('*/*'));
    expect(generic).toHaveLength(1);
    expect(extensionFilter).toContain('android:mimeType="*/*"');
    const patterns = [...extensionFilter.matchAll(/android:pathPattern="([^"]*)"/g)].map((m) => m[1]);
    expect(patterns.sort()).toEqual(['.*\\\\.FIT', '.*\\\\.GPX', '.*\\\\.fit', '.*\\\\.gpx'].sort());
    expect(extensionFilter).toContain('android:host="*"');
    expect(extensionFilter).toContain('android:scheme="content"');
    expect(extensionFilter).not.toContain('android:scheme="file"');
    expect(extensionFilter).toContain('android.intent.category.DEFAULT');
    expect(extensionFilter).not.toContain('BROWSABLE');
    expect(extensionFilter, 'json').not.toMatch(/json/i);
  });

  it('aucun filtre SEND ni autre filtre à type générique : le partage reste borné par ses types', () => {
    expect(allWithAction('SEND')).toHaveLength(1);
    expect(withAction('SEND')).not.toContain('*/*');
    expect(withAction('SEND')).not.toContain('pathPattern');
  });

  it('VIEW en content:// seulement, SEND sans schéma : une intention SEND n\'a pas d\'adresse, un schéma l\'exclurait', () => {
    expect(withAction('VIEW')).toContain('android:scheme="content"');
    expect(withAction('SEND')).not.toContain('android:scheme');
  });

  it('aucune permission de stockage : le droit de lecture vient de l\'intention', () => {
    expect(MANIFEST).not.toMatch(/READ_EXTERNAL_STORAGE|READ_MEDIA|MANAGE_EXTERNAL_STORAGE/);
  });
});

describe('manifeste Android : liaison sans fil avec le programme Windows', () => {
  const PLUGIN = repoFile('android/app/src/main/java/io/github/segneur/gtracker/ComputerLinkPlugin.java');

  it('lit l’état des réseaux, sans compter sur le manifeste d’un greffon', () => {
    const tag = tagWithName(MANIFEST, 'uses-permission', 'android.permission.ACCESS_NETWORK_STATE');
    expect(tag).toBeDefined();
    expect(tag).not.toContain('tools:node');
  });

  it('accès au réseau local déclaré seulement à partir de la cible 37, comme le demande la documentation d’Android', () => {
    expect(Number.isFinite(TARGET_SDK)).toBe(true);
    const tag = tagWithName(MANIFEST, 'uses-permission', 'android.permission.ACCESS_LOCAL_NETWORK');
    if (TARGET_SDK < 37) expect(tag).toBeUndefined();
    else expect(tag).toBeDefined();
  });

  it('accès au réseau local demandé seulement quand le téléphone et la cible de l’application atteignent 37', () => {
    expect(PLUGIN).toContain('LOCAL_NETWORK_SDK = 37;');
    const needs = PLUGIN.match(/private boolean needsLocalNetworkPermission\(\) \{([\s\S]*?)\n {4}\}/)?.[1] ?? '';
    expect(needs).toMatch(/Build\.VERSION\.SDK_INT >= LOCAL_NETWORK_SDK/);
    expect(needs).toMatch(/getApplicationInfo\(\)\.targetSdkVersion >= LOCAL_NETWORK_SDK/);
    expect(needs).toMatch(/getPermissionState\(LOCAL_NETWORK\)/);
  });

  it('aucun trafic en clair autorisé', () => {
    expect(MANIFEST).not.toContain('usesCleartextTraffic="true"');
    expect(MANIFEST).not.toContain('networkSecurityConfig');
  });

  it("ni service ni tâche de fond : la liaison se ferme quand l'application quitte l'écran", () => {
    expect(PLUGIN).not.toMatch(/startService|startForegroundService|WorkManager|JobScheduler|AlarmManager/);
    expect(PLUGIN).toMatch(/protected void handleOnStop\(\) \{[\s\S]*?stopAll\(\);/);
  });
});

describe('ceinture cardio : le journal ne la désigne pas', () => {
  const PLUGIN = withoutJavaComments(javaFile('HeartRatePlugin.java'));
  /** Chaque trace, sur une ou plusieurs lignes, jusqu'à la parenthèse qui la ferme en fin de ligne. */
  const logs = PLUGIN.match(/\bLog\.\w\([\s\S]*?\);\s*$/gm) ?? [];

  it('le journal est bien lu', () => {
    expect(logs.length).toBeGreaterThan(10);
  });

  it('aucune trace n’écrit l’adresse ni le nom de la ceinture (le journal se lit par adb)', () => {
    for (const log of logs) {
      expect(log, log).not.toMatch(/getString\("(address|name)"|\.getAddress\(\)|\.getName\(\)|\btargetName\b/);
    }
  });

  it('le type d’adresse et l’étiquette restent', () => {
    expect(PLUGIN).toContain('addressTypeText(');
    expect(PLUGIN).toMatch(/TAG = "GtrackerHR"/);
  });
});

describe('fichiers partagés : un seul dossier exposé', () => {
  const PATHS = withoutComments(repoFile('android/app/src/main/res/xml/file_paths.xml'));
  const SHARE = javaFile('ShareFilePlugin.java');
  const shareDir = SHARE.match(/SHARE_DIR = "([^"]+)";/)?.[1];

  it('le dossier du partage, pris dans le cache, est le seul que le FileProvider déclare', () => {
    expect(shareDir).toBeDefined();
    expect(SHARE).toContain('new File(getContext().getCacheDir(), SHARE_DIR)');
    const entries = PATHS.match(/<[\w-]+-path\b[^>]*>/g) ?? [];
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatch(/^<cache-path\b/);
    expect(entries[0]).toContain(`path="${shareDir}/"`);
  });
});

describe('logo et icône', () => {
  const background = withoutComments(repoFile('android/app/src/main/res/values/ic_launcher_background.xml'));

  it('fond de l’icône adaptative : une couleur unie (#F6F5F2), lue par les deux icônes adaptatives', () => {
    expect(background).toContain('<color name="ic_launcher_background">#F6F5F2</color>');
    for (const icon of ['ic_launcher', 'ic_launcher_round']) {
      expect(repoFile(`android/app/src/main/res/mipmap-anydpi-v26/${icon}.xml`)).toContain('<background android:drawable="@color/ic_launcher_background"/>');
    }
  });

  it('page web : titre « Gtracker » et favicon SVG de GONG', () => {
    const html = repoFile('index.html');
    expect(html).toContain('<title>Gtracker</title>');
    expect(html).toContain('href="/favicon.svg"');
    expect(fs.existsSync(new URL('../../public/favicon.svg', import.meta.url))).toBe(true);
  });
});
