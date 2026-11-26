import { Howl, Howler } from 'howler';
import type { GameSettings, ZoneId } from '../core/types';
import { bus } from '../core/EventBus';

/** Offline audio director. Uses bundled placeholders; real VO/SFX drop into public/assets/audio. */
export class AudioDirector {
  private music: Howl | null = null;
  private ambient: Howl | null = null;
  private enabledMusic = true;
  private settings: GameSettings = {
    musicVolume: 0.5,
    sfxVolume: 0.7,
    voVolume: 0.9,
    subtitles: true,
    fontScale: 1,
    cameraSensitivity: 1,
    emotionalDifficulty: 'normal',
    freePlay: false,
  };

  private zoneAmbient: Record<ZoneId, string> = {
    neighborhood: 'traffic',
    home: 'home',
    home_blue: 'home',
    home_yellow: 'home',
    school: 'school',
    shop: 'shop',
    park: 'birds',
    zoo: 'animals',
    luna: 'birds',
  };

  applySettings(settings: GameSettings): void {
    this.settings = settings;
    Howler.volume(1);
    if (this.music) this.music.volume(settings.musicVolume * (this.enabledMusic ? 1 : 0));
    if (this.ambient) this.ambient.volume(settings.sfxVolume * 0.35);
  }

  /** Soft procedural-ish loop via silent-safe paths; beeps for feedback when files missing. */
  playSfx(name: string): void {
    const freqMap: Record<string, number> = {
      click: 520,
      door: 180,
      success: 660,
      fail: 220,
      phone: 740,
      bell: 880,
      step: 140,
      spill: 300,
      buy: 490,
    };
    this.beep(freqMap[name] ?? 400, 0.08, this.settings.sfxVolume * 0.25);
  }

  playVo(clipId: string, text: string): void {
    bus.emit('subtitle', { text });
    const src = [`/assets/audio/vo/${clipId}.wav`, `/assets/audio/vo/${clipId}.mp3`];
    const moodClip = clipId.match(/^(talk-.+)-(happy|angry|sad)$/);
    if (moodClip) src.push(`/assets/audio/vo/${moodClip[1]}.wav`);
    else if (clipId.startsWith('talk-')) src.push(`/assets/audio/vo/${clipId}-happy.wav`);
    let failedSources = 0;
    const howl = new Howl({
      src,
      volume: this.settings.voVolume,
      onloaderror: () => {
        failedSources += 1;
        if (failedSources >= src.length) this.beep(340, 0.05, this.settings.voVolume * 0.15);
      },
    });
    try {
      howl.play();
    } catch {
      /* ignore */
    }
  }

  setZone(zone: ZoneId | 'home'): void {
    this.ambient?.stop();
    const ambientZone: ZoneId =
      zone === 'home_blue' || zone === 'home_yellow' ? 'home' : (zone as ZoneId);
    const key = this.zoneAmbient[ambientZone] ?? this.zoneAmbient.home;
    const src = `/assets/audio/ambient/${key}.mp3`;
    const wav = `/assets/audio/ambient/${key}.wav`;
    this.ambient = new Howl({
      src: [src, wav],
      loop: true,
      volume: this.settings.sfxVolume * 0.35,
      onloaderror: () => {
        this.ambient = null;
      },
    });
    try {
      this.ambient.play();
    } catch {
      /* no file yet */
    }
  }

  toggleMusic(): boolean {
    this.enabledMusic = !this.enabledMusic;
    if (!this.enabledMusic) {
      this.music?.stop();
    } else {
      this.startMusic();
    }
    bus.emit('music-toggled', this.enabledMusic);
    return this.enabledMusic;
  }

  startMusic(): void {
    if (!this.enabledMusic) return;
    this.music?.stop();
    this.music = new Howl({
      src: ['/assets/audio/music/theme.mp3', '/assets/audio/music/theme.wav'],
      loop: true,
      volume: this.settings.musicVolume,
      onloaderror: () => {
        this.music = null;
      },
    });
    try {
      this.music.play();
    } catch {
      /* placeholder */
    }
  }

  private beep(freq: number, duration: number, volume: number): void {
    try {
      const ctx = Howler.ctx;
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.value = Math.max(0, Math.min(1, volume));
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.stop(ctx.currentTime + duration);
    } catch {
      /* AudioContext may be blocked until gesture */
    }
  }
}
