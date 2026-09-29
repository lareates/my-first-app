/**
 * 白噪音 × 氛围背景 — 场景配置表
 * 新增场景：加背景图 + 加一条配置 +（可选）SOUNDSCAPE_SCENE_MAP 映射
 */
const SceneBackgroundConfig = (() => {
  /** @type {Record<string, object>} */
  const SCENES = {
    spring_rain_roof: {
      id: 'spring_rain_roof',
      name: '春雨车顶',
      backgroundImage: 'assets/ambient/spring-rain-roof.webp',
      fallbackGradient:
        'linear-gradient(180deg, #0c1422 0%, #121c30 42%, #0a1018 100%)',
      overlay: {
        opacity: 0.28,
        gradient:
          'linear-gradient(to bottom, rgba(5,7,12,0.14), rgba(5,7,12,0.34))',
      },
      animationType: 'rain',
      animationIntensity: 'very_low',
      animationDensity: 'low',
      animationDuration: 6.5,
      reduceMotionFallback: true,
      lowPerformanceFallback: true,
    },
    forest_stream: {
      id: 'forest_stream',
      name: '溪水潺潺',
      backgroundImage: 'assets/ambient/forest-stream.webp',
      fallbackGradient:
        'linear-gradient(180deg, #081414 0%, #0c2422 48%, #071618 100%)',
      overlay: {
        opacity: 0.26,
        gradient:
          'linear-gradient(to bottom, rgba(5,10,10,0.12), rgba(4,12,12,0.32))',
      },
      animationType: 'water_shift',
      animationIntensity: 'very_low',
      animationDensity: 'very_low',
      animationDuration: 12,
      reduceMotionFallback: true,
      lowPerformanceFallback: true,
    },
    tidal_beach: {
      id: 'tidal_beach',
      name: '潮汐海滨',
      backgroundImage: 'assets/ambient/tidal-beach.webp',
      fallbackGradient:
        'linear-gradient(180deg, #080e1a 0%, #101c34 50%, #0a101c 100%)',
      overlay: {
        opacity: 0.3,
        gradient:
          'linear-gradient(to bottom, rgba(5,7,14,0.1), rgba(5,7,14,0.36))',
      },
      animationType: 'breathing_wave',
      animationIntensity: 'very_low',
      animationDensity: 'very_low',
      animationDuration: 11,
      reduceMotionFallback: true,
      lowPerformanceFallback: true,
    },
    window_breeze: {
      id: 'window_breeze',
      name: '窗外微风',
      backgroundImage: 'assets/ambient/window-breeze.webp',
      fallbackGradient:
        'linear-gradient(180deg, #0a1214 0%, #122226 46%, #0c1418 100%)',
      overlay: {
        opacity: 0.24,
        gradient:
          'linear-gradient(to bottom, rgba(5,8,10,0.12), rgba(5,8,10,0.3))',
      },
      animationType: 'soft_sway',
      animationIntensity: 'very_low',
      animationDensity: 'very_low',
      animationDuration: 9,
      reduceMotionFallback: true,
      lowPerformanceFallback: true,
    },
  };

  /** 声景 ID → 场景 ID（仅映射有氛围图的白噪音） */
  const SOUNDSCAPE_SCENE_MAP = {
    rain: 'spring_rain_roof',
    stream: 'forest_stream',
    waves: 'tidal_beach',
    wind: 'window_breeze',
  };

  function get(sceneId) {
    return SCENES[sceneId] || null;
  }

  function fromSoundscape(soundscapeId) {
    const id = SOUNDSCAPE_SCENE_MAP[soundscapeId];
    return id ? SCENES[id] : null;
  }

  function sceneIdForSoundscape(soundscapeId) {
    return SOUNDSCAPE_SCENE_MAP[soundscapeId] || null;
  }

  function all() {
    return Object.values(SCENES);
  }

  return {
    SCENES,
    SOUNDSCAPE_SCENE_MAP,
    get,
    fromSoundscape,
    sceneIdForSoundscape,
    all,
  };
})();
