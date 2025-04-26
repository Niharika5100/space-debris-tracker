let tleData = [];
let viewer;

function initCesiumViewer() {
  viewer = new Cesium.Viewer('cesiumContainer', {
    imageryProvider: new Cesium.TileMapServiceImageryProvider({
      url: Cesium.buildModuleUrl("Assets/Textures/NaturalEarthII"),
    }),
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    infoBox: false,
    navigationHelpButton: false,
    sceneModePicker: false
  });

  viewer.scene.globe.enableLighting = true;
}

function parseTLEFile(text) {
  tleData = [];
  const lines = text.trim().split('\n');
  for (let i = 0; i < lines.length - 2; i++) {
    if (lines[i].startsWith('0') && lines[i+1].startsWith('1') && lines[i+2].startsWith('2')) {
      tleData.push({
        name: lines[i].substring(2).trim(),
        line1: lines[i+1].trim(),
        line2: lines[i+2].trim()
      });
      i += 2;
    }
  }
  loadAllSatellites();
}

function loadAllSatellites() {
  tleData.forEach((_, idx) => {
    loadSatellite(idx);
  });
}

function loadSatellite(index) {
  const sat = tleData[index];
  const satrec = satellite.twoline2satrec(sat.line1, sat.line2);

  const totalSeconds = 3600 * 2;
  const timestepInSeconds = 60;
  const startTime = Cesium.JulianDate.now();
  const positionsOverTime = new Cesium.SampledPositionProperty();

  for (let i = 0; i < totalSeconds; i += timestepInSeconds) {
    const time = Cesium.JulianDate.addSeconds(startTime, i, new Cesium.JulianDate());
    const jsDate = Cesium.JulianDate.toDate(time);
    const pv = satellite.propagate(satrec, jsDate);

    if (pv.position && pv.velocity) {
      const gmst = satellite.gstime(jsDate);
      const pos = satellite.eciToGeodetic(pv.position, gmst);
      const lat = pos.latitude;
      const lon = pos.longitude;
      const alt = pos.height;

      const position = Cesium.Cartesian3.fromRadians(lon, lat, alt * 1000);
      positionsOverTime.addSample(time, position);
    }
  }

  viewer.entities.add({
    name: sat.name,
    position: positionsOverTime,
    billboard: {
      image: 'debris.png',
      width: 7,
      height: 7
    },
    label: {
        text: sat.name,
        font: "14px sans-serif",
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -9),
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0.0, 20000.0) // tighter zoom required
      },
    path: {
      resolution: timestepInSeconds,
      material: new Cesium.PolylineGlowMaterialProperty({
        glowPower: 0.2,
        color: Cesium.Color.YELLOW
      }),
      width: 2
    }
  });
}

initCesiumViewer();

fetch('tle-data.txt')
  .then(response => response.text())
  .then(text => parseTLEFile(text))
  .catch(error => console.error('Error loading TLE file:', error));
