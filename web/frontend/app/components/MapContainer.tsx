'use client';

// 引入 React 和 OpenLayers 所需模块
import React, { useEffect, useRef, useState } from 'react';
import 'ol/ol.css';
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import { fromLonLat } from 'ol/proj';
import { defaults as defaultControls, ScaleLine, MousePosition } from 'ol/control';
import { createStringXY } from 'ol/coordinate';
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { Style, Circle as CircleStyle, Fill, Stroke, Text } from 'ol/style';
import Cluster from 'ol/source/Cluster';
import Overlay from 'ol/Overlay';
import { easeOut } from 'ol/easing';



// 聚合点弹窗组件，支持分页轮播、点击切页、排序
function ClusterPopup({ features }: { features: any[] }) {
  const [page, setPage] = useState(0);
  const [playing, setPlaying] = useState(true);
  const perPage = 3;
  const sorted = [...features].sort((a, b) => b.get('risk') - a.get('risk'));
  const pages = Math.ceil(sorted.length / perPage);

  useEffect(() => {
    if (!playing || pages <= 1) return;
    const interval = setInterval(() => {
      setPage((p) => (p + 1) % pages);
    }, 5000);
    return () => clearInterval(interval);
  }, [playing, pages]);

  const getColor = (v: number) => (v > 0.7 ? '#ff4d4f' : v > 0.4 ? '#ffb800' : '#00ffff');
  const visible = sorted.slice(page * perPage, (page + 1) * perPage);

  return (
    <div className="absolute top-2 right-2 z-50 w-[300px] bg-[#001c2bcc] backdrop-blur border border-cyan-400 rounded-xl p-3 shadow-xl select-none">
      <h3 className="text-cyan-300 text-base font-bold mb-2">聚合点详情</h3>
      <div className="space-y-2 overflow-hidden">
        {visible.map((f) => (
          <div
            key={f.get('name')}
            className="p-2 rounded-lg border border-cyan-500 bg-[#002335bb] text-white text-sm shadow-md backdrop-blur-sm transition-all duration-300"
          >
            <div className="text-cyan-300 font-bold mb-1">{f.get('name')}</div>
            <div className="text-xs">温度：{f.get('temp')}°C 湿度：{f.get('hum')}%</div>
            <div className="text-xs" style={{ color: getColor(f.get('risk')) }}>
              滑坡概率：{(f.get('risk') * 100).toFixed(0)}%
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex gap-1 items-center">
          {Array.from({ length: pages }).map((_, i) => (
            <span
              key={i}
              className={`w-2 h-2 rounded-full ${i === page ? 'bg-cyan-300' : 'bg-cyan-700'} transition-all cursor-pointer`}
              onClick={() => setPage(i)}
            />
          ))}
        </div>
        <button
          className="text-cyan-300 border border-cyan-300 px-3 py-1 rounded hover:bg-cyan-800/20 text-xs"
          onClick={() => setPlaying(!playing)}
        >
          {playing ? '暂停轮播' : '开始轮播'}
        </button>
      </div>
    </div>
  );
}

// 地图主组件 MapContainer
export default function MapContainer({ mode }: { mode: '2D' | '卫星图' }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<Map | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [clusterPoints, setClusterPoints] = useState<any[] | null>(null);

  useEffect(() => {
    if (mapInstance.current) mapInstance.current.setTarget(undefined);
    if (!mapRef.current) return;

    const getRiskColor = (val: number) => (val > 0.7 ? '#ff4d4f' : val > 0.4 ? '#ffb800' : '#00ffff');

    const points = [
      { name: '监测点 A', coord: [110.1881, 22.684], temp: 26.5, hum: 85, risk: 0.78 },
      { name: '监测点 B', coord: [110.19, 22.625], temp: 25.1, hum: 80, risk: 0.42 },
      { name: '监测点 C', coord: [110.17, 22.635], temp: 27.2, hum: 88, risk: 0.22 },
      { name: '监测点 D', coord: [110.178, 22.628], temp: 28.6, hum: 75, risk: 0.63 },
      { name: '监测点 E', coord: [110.175, 22.627], temp: 24.8, hum: 83, risk: 0.34 },
    ];

    const tdtKey = 'cc688e28c157fc3473807854c945f375';
    const createTdtLayer = (layerType: string) => new TileLayer({
      source: new XYZ({
        url: `https://t{0-7}.tianditu.gov.cn/${layerType}_w/wmts?tk=${tdtKey}&SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${layerType}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}`,
        wrapX: true,
      }),
    });

    const createOSMLayer = () => new TileLayer({
      source: new XYZ({
        url: 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        crossOrigin: 'anonymous',
      }),
    });

    const baseLayer = mode === '卫星图' ? [createTdtLayer('img'), createTdtLayer('cia')] : [createOSMLayer()];

    const map = new Map({
      target: mapRef.current!,
      layers: baseLayer,
      view: new View({
        center: fromLonLat([110.1805, 22.6263]),
        zoom: 11,
        maxZoom: 18,
        minZoom: 5,
      }),
      controls: defaultControls().extend([
        new ScaleLine(),
        new MousePosition({
          coordinateFormat: createStringXY(4),
          projection: 'EPSG:4326',
          className: 'mouse-position',
        })
      ])
    });

    const features = points.map(p => {
      const f = new Feature({ geometry: new Point(fromLonLat(p.coord)), ...p });
      f.setStyle(new Style({
        image: new CircleStyle({ radius: 8, fill: new Fill({ color: 'rgba(0,255,255,0.6)' }), stroke: new Stroke({ color: '#00ffff', width: 2 }) }),
        text: new Text({ text: p.name, offsetY: -18, fill: new Fill({ color: '#00ffff' }), stroke: new Stroke({ color: '#001529', width: 2 }), font: '12px sans-serif' })
      }));
      return f;
    });

    const clusterSource = new Cluster({ distance: 40, source: new VectorSource({ features }) });
    const clusterLayer = new VectorLayer({
      source: clusterSource,
      style: f => {
        const size = f.get('features').length;
        return size === 1 ? f.get('features')[0].getStyle() : new Style({
          image: new CircleStyle({ radius: 12, fill: new Fill({ color: 'rgba(0,255,255,0.5)' }), stroke: new Stroke({ color: '#00ffff', width: 2 }) }),
          text: new Text({ text: size.toString(), fill: new Fill({ color: '#fff' }), font: 'bold 12px sans-serif' })
        });
      }
    });
    map.addLayer(clusterLayer);

    const overlay = new Overlay({
      element: overlayRef.current!,
      autoPan: { animation: { duration: 300, easing: easeOut } },
      offset: [0, -10],
    });
    map.addOverlay(overlay);

    map.on('singleclick', e => {
      const fs = map.getFeaturesAtPixel(e.pixel);
      overlay.setPosition(undefined);
      setClusterPoints(null);

      if (fs && fs.length > 0) {
        const cluster = fs[0].get('features');
        if (cluster.length === 1) {
          const f = cluster[0];
          overlayRef.current!.innerHTML = `
            <div style="background: rgba(0,21,41,0.85); border: 1px solid #00ffff; border-radius: 10px; box-shadow: 0 0 10px rgba(0,255,255,0.4); padding: 10px 14px; color: #fff; font-family: 'Microsoft YaHei'; font-size: 12px; line-height: 1.8; white-space: nowrap; caret-color: transparent; user-select: none; pointer-events: none;">
              <div style="font-size: 14px; font-weight: bold; color: #00ffff;">${f.get('name')}</div>
              <div><span style="color:#ccc;">温度：</span>${f.get('temp')}°C</div>
              <div><span style="color:#ccc;">湿度：</span>${f.get('hum')}%</div>
              <div><span style="color:#ccc;">滑坡概率：</span><span style="color: ${getRiskColor(f.get('risk'))};">${(f.get('risk') * 100).toFixed(0)}%</span></div>
            </div>`;
          overlay.setPosition(f.getGeometry().getCoordinates());
        } else {
          setClusterPoints(cluster);
        }
      }
    });

    mapInstance.current = map;
  }, [mode]);

  return (
    <div className="w-full h-full relative rounded-2xl shadow-inner overflow-hidden">
      <div ref={mapRef} className="w-full h-full" />
      <div ref={overlayRef} className="absolute z-50 transition-all duration-300 ease-in-out select-none caret-transparent pointer-events-none" />
      {clusterPoints && <ClusterPopup features={clusterPoints} />}
    </div>
  );
}
