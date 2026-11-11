import { env } from './env';

export interface MapPoint {
  lat: number;
  lng: number;
  kind: 'wh' | 'central' | 'ret';
  label: string;
  sub?: string;
  regionId?: string;
  regionName?: string;
}

export interface MapDocOptions {
  center: [number, number];
  points?: MapPoint[];
  radiusKm?: number;
  zoom?: number;
  interactivePick?: boolean;
  selectedRegionId?: string | null;
  selectedWarehouseCode?: string | null;
  pickHint?: string;
  pinTooltip?: string;
}

/**
 * Generates an HTML document for iframe srcDoc using Leaflet & Vietmap Map API tiles.
 * - Supports both Warehouse (orange square marker) and Retailer (blue round marker).
 * - Interactive pick mode for address/coordinate picking via postMessage:
 *   - Emits window.parent.postMessage({ type: 'mapPick', lat, lng }, '*') and { type: 'fscm:pick-coords', lat, lng }
 *   - Listens to { type: 'setPoint', lat, lng } or { type: 'fscm:set-center', lat, lng } to move pin/circle smoothly.
 * - Safe fallback to SVG grid map when Leaflet or network fails.
 */
export function buildMapDoc({
  center,
  points = [],
  radiusKm = 0,
  zoom = 13,
  interactivePick = false,
  selectedRegionId = null,
  selectedWarehouseCode = null,
  pickHint = 'Nhấp hoặc kéo ghim để chọn vị trí & đồng bộ địa chỉ',
  pinTooltip = 'Vị trí đang chọn (kéo ghim để đổi)',
}: MapDocOptions): string {
  // Filter warehouses based on selection if provided
  let filteredPoints = points;
  if (selectedWarehouseCode) {
    const codeUpper = selectedWarehouseCode.trim().toUpperCase();
    filteredPoints = points.filter((p) => {
      if (p.kind === 'wh' || p.kind === 'central') {
        const labelUpper = p.label.toUpperCase();
        return labelUpper.startsWith(codeUpper) || labelUpper.includes(codeUpper);
      }
      return true; // Keep retailers for context
    });
  } else if (selectedRegionId) {
    filteredPoints = points.filter((p) => {
      if (p.kind === 'wh' || p.kind === 'central') {
        return p.regionId === selectedRegionId;
      }
      return true;
    });
  }

  // Find center if a warehouse or region is selected
  const whPoints = filteredPoints.filter((p) => p.kind === 'wh' || p.kind === 'central');
  let effectiveCenter: [number, number] = center;
  if (selectedWarehouseCode && whPoints.length > 0) {
    effectiveCenter = [whPoints[0].lat, whPoints[0].lng];
  } else if (selectedRegionId && whPoints.length > 0) {
    effectiveCenter = [whPoints[0].lat, whPoints[0].lng];
  }

  const safeCenter: [number, number] = [
    Number.isFinite(effectiveCenter[0]) && effectiveCenter[0] !== 0 ? effectiveCenter[0] : 10.8744,
    Number.isFinite(effectiveCenter[1]) && effectiveCenter[1] !== 0 ? effectiveCenter[1] : 106.6511,
  ];

  const ptsJson = JSON.stringify(filteredPoints).replace(/</g, '\\u003c');
  const centerJson = JSON.stringify(safeCenter);
  const radMeters = (radiusKm || 0) * 1000;
  const pickEnabled = interactivePick ? 'true' : 'false';
  const apiKey = env.vietmap.apiKey;
  const initialZoom = selectedWarehouseCode ? 13 : zoom;

  const hasWh = filteredPoints.some((p) => p.kind === 'wh' || p.kind === 'central');
  const hasRet = filteredPoints.some((p) => p.kind === 'ret');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"/>
<style>
  html,body,#m{height:100%;margin:0;padding:0;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#EEF2EC}
  
  /* Legend */
  .lg{position:absolute;bottom:10px;left:10px;z-index:999;background:rgba(255,255,255,0.96);backdrop-filter:blur(4px);padding:6px 12px;border-radius:6px;border:1px solid #CBD5E1;font-size:11.5px;box-shadow:0 1px 3px rgba(0,0,0,.1);display:flex;gap:12px;align-items:center;flex-wrap:wrap;color:#1E293B}
  .pick-hint{color:#0D9488;font-weight:600}

  /* SVG Fallback */
  #fb{display:none;height:100%;width:100%;position:relative;background:#EEF2EE}
  #fb svg{width:100%;height:100%}
</style></head><body>
<div id="m"></div>
<div id="fb"><svg viewBox="0 0 800 420" preserveAspectRatio="xMidYMid meet"></svg></div>

<div class="lg">
  ${hasWh || (!hasWh && !hasRet && !interactivePick) ? '<span><b style="color:#B85C1E">■</b> Kho</span>' : ''}
  ${hasRet || (!hasWh && !hasRet) ? '<span><b style="color:#1D4ED8">●</b> Điểm bán (Retailer)</span>' : ''}
  ${radiusKm > 0 ? `<span><span style="color:#0D9488;font-weight:700">◯</span> Bán kính ${radiusKm} km</span>` : ''}
  ${interactivePick ? `<span class="pick-hint">· ${pickHint}</span>` : ''}
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<script>
var C=${centerJson}, P=${ptsJson}, R=${radMeters}, Z=${initialZoom}, PICK=${pickEnabled};
var VM_KEY=${JSON.stringify(apiKey)};

var map=null, mk=null, centerCircle=null;

function emitPick(lat,lng){
  var safeLat = Math.round(Number(lat)*10000)/10000;
  var safeLng = Math.round(Number(lng)*10000)/10000;
  window.parent.postMessage({type:'mapPick',lat:safeLat,lng:safeLng},'*');
  window.parent.postMessage({type:'fscm:pick-coords',lat:safeLat,lng:safeLng},'*');
}

window.addEventListener('message',function(ev){
  if(!ev.data) return;
  if((ev.data.type==='setPoint'||ev.data.type==='fscm:set-center') && typeof ev.data.lat==='number'){
    var la = ev.data.lat, ln = ev.data.lng;
    if(mk) mk.setLatLng([la, ln]);
    if(centerCircle) centerCircle.setLatLng([la, ln]);
    if(map) map.panTo([la, ln]);
  }
});

function fallback(){
  document.getElementById('m').style.display='none';
  var fb=document.getElementById('fb'); fb.style.display='block';
  var s=fb.querySelector('svg');
  var lats=P.map(function(p){return p.lat;}).concat([C[0]]);
  var lngs=P.map(function(p){return p.lng;}).concat([C[1]]);
  var minLat=Math.min.apply(null,lats)-0.04, maxLat=Math.max.apply(null,lats)+0.04;
  var minLng=Math.min.apply(null,lngs)-0.05, maxLng=Math.max.apply(null,lngs)+0.05;
  function x(lng){return 40+(lng-minLng)/(maxLng-minLng||0.08)*720;}
  function y(lat){return 380-(lat-minLat)/(maxLat-minLat||0.06)*340;}

  var h='<rect width="800" height="420" fill="#EEF4EF"/>';
  for(var i=0;i<800;i+=80) h+='<line x1="'+i+'" y1="0" x2="'+i+'" y2="420" stroke="#DDE5DF"/>';
  for(var j=0;j<420;j+=60) h+='<line x1="0" y1="'+j+'" x2="800" y2="'+j+'" stroke="#DDE5DF"/>';
  
  if(R>0){
    P.forEach(function(p){
      if(p.kind==='wh'||p.kind==='central'){
        var rx=(R/111000)/(maxLng-minLng||0.08)*720;
        h+='<circle cx="'+x(p.lng)+'" cy="'+y(p.lat)+'" r="'+rx+'" fill="#14B8A6" fill-opacity="0.12" stroke="#0D9488" stroke-width="2" stroke-dasharray="5 5"/>';
      }
    });
  }
  
  P.forEach(function(p){
    var isW = p.kind==='wh'||p.kind==='central';
    var c = isW ? '#B85C1E' : '#1D4ED8';
    h+='<circle cx="'+x(p.lng)+'" cy="'+y(p.lat)+'" r="'+(isW?8:6)+'" fill="'+c+'" stroke="#fff" stroke-width="2"/><text x="'+(x(p.lng)+11)+'" y="'+(y(p.lat)+4)+'" font-size="11" fill="#1E293B" font-weight="600">'+p.label+'</text>';
  });

  if(PICK){
    h+='<circle cx="'+x(C[1])+'" cy="'+y(C[0])+'" r="10" fill="#B42318" stroke="#fff" stroke-width="3"/>';
    h+='<text x="10" y="24" font-size="12" fill="#0D9488" font-weight="600">Bấm vào khung bản đồ để chọn tọa độ.</text>';
  }
  s.innerHTML=h;
  if(PICK){
    fb.style.cursor='crosshair';
    fb.addEventListener('click',function(ev){
      var rect=fb.getBoundingClientRect();
      var vx=(ev.clientX-rect.left)/rect.width*800;
      var vy=(ev.clientY-rect.top)/rect.height*420;
      var lng=minLng+(vx-40)/720*(maxLng-minLng||0.08);
      var lat=minLat+(380-vy)/340*(maxLat-minLat||0.06);
      C=[lat,lng];
      emitPick(lat,lng);
      fallback();
    });
  }
}

try{
  if(!window.L) throw 0;
  map=L.map('m').setView(C,Z);

  var tileUrl = VM_KEY
    ? 'https://maps.vietmap.vn/maps/tiles/st/{z}/{x}/{y}.png?apikey=' + encodeURIComponent(VM_KEY)
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  var tileAttr = VM_KEY
    ? '&copy; <a href="https://vietmap.vn" target="_blank" rel="noreferrer">Vietmap</a>'
    : '&copy; OpenStreetMap';

  var tl = L.tileLayer(tileUrl, { maxZoom: 19, attribution: tileAttr }).addTo(map);
  tl.on('tileerror', function() {
    if (VM_KEY && !this._fallbackTriggered) {
      this._fallbackTriggered = true;
      map.removeLayer(this);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
    }
  });

  var bounds = [];

  // Draw service radius circles if radiusKm > 0
  if(R > 0){
    P.forEach(function(p){
      var isW = p.kind === 'wh' || p.kind === 'central';
      if(!isW) return;

      var c = L.circle([p.lat, p.lng], {
        radius: R,
        color: '#0D9488',
        weight: 2,
        dashArray: '5, 5',
        fillColor: '#14B8A6',
        fillOpacity: 0.12
      }).addTo(map);
      c.bindTooltip('<b>Bán kính ' + Math.round(R/1000) + ' km:</b><br/>' + p.label, { sticky: true });
    });
  }

  // Draw Markers
  P.forEach(function(p){
    var isW = p.kind === 'wh' || p.kind === 'central';
    var markerColor = isW ? '#B85C1E' : '#1D4ED8';
    var radius = isW ? 9 : 7;

    var marker = L.circleMarker([p.lat, p.lng], {
      radius: radius,
      color: '#fff',
      weight: 2,
      fillColor: markerColor,
      fillOpacity: 0.96
    }).addTo(map);

    var infoHtml = '<b>' + (isW ? 'Kho: ' : 'Điểm bán: ') + p.label + '</b>';
    if(p.sub) infoHtml += '<br/>' + p.sub;
    if(p.regionName) infoHtml += '<br/><span style="color:#0D9488;font-weight:600">Vùng: ' + p.regionName + '</span>';
    infoHtml += '<br/><small>[' + p.lat + ', ' + p.lng + ']</small>';
    marker.bindPopup(infoHtml);

    marker.bindTooltip(p.label, { permanent: true, direction: 'top', offset: [0, -radius] });
    bounds.push([p.lat, p.lng]);
  });

  // Fit bounds when points are displayed in view mode
  if(bounds.length > 1 && !PICK){
    try {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    } catch(e){}
  } else if(bounds.length === 1 && !PICK){
    map.setView(bounds[0], 14);
  }

  // Interactive picking pin in edit mode
  if(PICK){
    map.getContainer().style.cursor='crosshair';
    mk=L.marker(C,{draggable:true,title:'Vị trí đang chọn'}).addTo(map);
    mk.bindTooltip(${JSON.stringify(pinTooltip)},{permanent:false,direction:'top'});

    if(R > 0){
      centerCircle = L.circle(C,{
        radius: R,
        color: '#0D9488',
        weight: 2,
        dashArray: '5, 5',
        fillColor: '#14B8A6',
        fillOpacity: 0.12
      }).addTo(map);
      centerCircle.bindTooltip('Bán kính phục vụ ' + Math.round(R/1000) + ' km');
    }

    mk.on('dragend',function(e){
      var p=e.target.getLatLng();
      if(centerCircle) centerCircle.setLatLng(p);
      emitPick(p.lat, p.lng);
    });

    map.on('click',function(e){
      mk.setLatLng(e.latlng);
      if(centerCircle) centerCircle.setLatLng(e.latlng);
      emitPick(e.latlng.lat, e.latlng.lng);
    });
  }
}catch(e){fallback();}
</script></body></html>`;
}

export const buildWarehouseMapDoc = buildMapDoc;

