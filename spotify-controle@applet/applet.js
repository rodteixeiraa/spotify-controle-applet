const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const GdkPixbuf = imports.gi.GdkPixbuf;
imports.gi.versions.Soup = '3.0';
const Soup = imports.gi.Soup;

const BUS_NAME = 'org.mpris.MediaPlayer2.spotify';
const OBJECT_PATH = '/org/mpris/MediaPlayer2';
const PLAYER = 'org.mpris.MediaPlayer2.Player';
const PROPERTIES = 'org.freedesktop.DBus.Properties';

class SpotifyApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);
        this._alive = true;
        this._generation = 0;
        this._bus = Gio.DBus.session;
        this._artUrl = '';
        this._artGeneration = 0;
        this._playing = false;
        this._angle = 0;
        this._session = new Soup.Session();
        this._artPath = '';
        this._instanceId = instanceId;
        this.set_applet_icon_path(GLib.build_filenamev([metadata.path, 'vinil.svg']));
        this.actor.add_style_class_name('spotify-panel');
        this.set_applet_tooltip('Spotify Controle');
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this._visual = new St.BoxLayout({ vertical: true, style_class: 'spotify-visual' });
        this._disc = new St.Bin({ style_class: 'spotify-disc', x_align: St.Align.MIDDLE });
        this._disc.set_pivot_point(0.5, 0.5);
        this._cover = new St.Bin({ style_class: 'spotify-cover', x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE });
        this._cover.set_child(new St.Icon({ icon_name: 'audio-x-generic-symbolic', icon_size: 28 }));
        this._disc.set_child(this._cover);
        this._visual.add(this._disc, { x_align: St.Align.MIDDLE });
        this.menu.addActor(this._visual);
        this._timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
            if (this._playing && this.menu.isOpen) {
                this._angle = (this._angle + 1) % 360;
                this._disc.rotation_angle_z = this._angle;
            }
            return GLib.SOURCE_CONTINUE;
        });

        this._track = new PopupMenu.PopupMenuItem('Spotify não está aberto', { reactive: false });
        this._artist = new PopupMenu.PopupMenuItem('Abra o aplicativo Spotify', { reactive: false });
        this.menu.addMenuItem(this._track);
        this.menu.addMenuItem(this._artist);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._previous = this._button('Faixa anterior', 'media-skip-backward-symbolic', 'Previous');
        this._play = this._button('Reproduzir / pausar', 'media-playback-start-symbolic', 'PlayPause');
        this._next = this._button('Próxima faixa', 'media-skip-forward-symbolic', 'Next');
        this._setOffline();

        this._signal = this._bus.signal_subscribe(BUS_NAME, PROPERTIES, 'PropertiesChanged', OBJECT_PATH, PLAYER,
            Gio.DBusSignalFlags.NONE, () => this._refresh());
        this._watch = Gio.bus_watch_name(Gio.BusType.SESSION, BUS_NAME, Gio.BusNameWatcherFlags.NONE,
            () => this._refresh(), () => this._setOffline());
    }

    _button(label, icon, method) {
        let item = new PopupMenu.PopupIconMenuItem(label, icon, imports.gi.St.IconType.SYMBOLIC);
        item.connect('activate', () => this._command(method));
        this.menu.addMenuItem(item);
        return item;
    }

    _setOffline() {
        this._generation++;
        this._playing = false;
        this._loadArt('');
        this.set_applet_label('Spotify');
        this.set_applet_tooltip('Spotify não está aberto');
        this._track.label.set_text('Spotify não está aberto');
        this._artist.label.set_text('Abra o aplicativo Spotify');
        for (let item of [this._previous, this._play, this._next]) item.setSensitive(false);
    }

    _refresh() {
        let generation = ++this._generation;
        this._bus.call(BUS_NAME, OBJECT_PATH, PROPERTIES, 'GetAll',
            new GLib.Variant('(s)', [PLAYER]), new GLib.VariantType('(a{sv})'),
            Gio.DBusCallFlags.NONE, -1, null, (bus, result) => {
                if (!this._alive || generation !== this._generation) return;
                try {
                    let props = bus.call_finish(result).deep_unpack()[0];
                    let value = (key, fallback) => props[key] ? props[key].deep_unpack() : fallback;
                    let metadata = value('Metadata', {});
                    let field = (key, fallback) => metadata[key] ? metadata[key].deep_unpack() : fallback;
                    let title = field('xesam:title', 'Nenhuma música selecionada');
                    let artists = field('xesam:artist', []);
                    let artist = artists.length ? artists.join(', ') : 'Artista desconhecido';
                    let playing = value('PlaybackStatus', '') === 'Playing';
                    this._playing = playing;
                    this._loadArt(field('mpris:artUrl', ''));
                    let panelText = title.length > 32 ? title.slice(0, 31) + '…' : title;
                    this.set_applet_label((playing ? '♪ ' : 'Ⅱ ') + panelText);
                    this.set_applet_tooltip(title + ' — ' + artist);
                    this._track.label.set_text(title);
                    this._artist.label.set_text(artist);
                    this._play.label.set_text(playing ? 'Pausar' : 'Reproduzir');
                    this._previous.setSensitive(value('CanControl', false) && value('CanGoPrevious', false));
                    this._next.setSensitive(value('CanControl', false) && value('CanGoNext', false));
                    this._play.setSensitive(value('CanControl', false) && (playing ? value('CanPause', false) : value('CanPlay', false)));
                } catch (e) {
                    this._setOffline();
                }
            });
    }

    _loadArt(url) {
        if (url === this._artUrl) return;
        this._artUrl = url;
        const generation = ++this._artGeneration;
        this._cover.set_style(null);
        this._cover.set_child(new St.Icon({ icon_name: 'audio-x-generic-symbolic', icon_size: 28 }));
        this._visual.set_style(null);
        this.actor.set_style(null);
        if (!url || !/^https?:\/\//i.test(url)) return;
        try {
            let message = Soup.Message.new('GET', url);
            this._session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (session, result) => {
                if (!this._alive || generation !== this._artGeneration) return;
                try {
                    let bytes = session.send_and_read_finish(result);
                    if (message.get_status() !== 200 || bytes.get_size() > 5 * 1024 * 1024) return;
                    let loader = new GdkPixbuf.PixbufLoader();
                    loader.write(bytes.get_data());
                    loader.close();
                    let image = loader.get_pixbuf();
                    if (!image) return;
                    let previousPath = this._artPath;
                    this._artPath = GLib.build_filenamev([GLib.get_user_cache_dir(), 'spotify-controle-' + this._instanceId + '-' + generation + '.png']);
                    image.scale_simple(70, 70, GdkPixbuf.InterpType.BILINEAR).savev(this._artPath, 'png', [], []);
                    if (previousPath) { try { Gio.File.new_for_path(previousPath).delete(null); } catch (e) {} }
                    let sample = image.scale_simple(1, 1, GdkPixbuf.InterpType.BILINEAR).get_pixels();
                    let r = sample[0], g = sample[1], b = sample[2];
                    this._visual.set_style(`background-color: rgb(${Math.round(r * 0.22)}, ${Math.round(g * 0.22)}, ${Math.round(b * 0.22)});`);
                    this.actor.set_style(`background-color: rgba(${r}, ${g}, ${b}, 0.25);`);
                    this._cover.set_child(null);
                    this._cover.set_style(`background-image: url("${this._artPath}");`);
                } catch (e) { global.logError(e); }
            });
        } catch (e) { global.logError(e); }
    }

    _command(method) {
        this._bus.call(BUS_NAME, OBJECT_PATH, PLAYER, method, null, null,
            Gio.DBusCallFlags.NONE, -1, null, (bus, result) => {
                try { bus.call_finish(result); } catch (e) { global.logError(e); }
            });
    }

    on_applet_clicked() { this.menu.toggle(); }

    on_applet_removed_from_panel() {
        this._alive = false;
        this._generation++;
        this._artGeneration++;
        GLib.source_remove(this._timer);
        this._session.abort();
        if (this._artPath) { try { Gio.File.new_for_path(this._artPath).delete(null); } catch (e) {} }
        Gio.bus_unwatch_name(this._watch);
        this._bus.signal_unsubscribe(this._signal);
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new SpotifyApplet(metadata, orientation, panelHeight, instanceId);
}
