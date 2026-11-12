import { env } from './env';
import { isValidCoordinate } from './geocoding';

export interface MapPoint {
  lat: number | null | undefined;
  lng: number | null | undefined;
  kind: 'wh' | 'central' | 'ret';
  label: string;
  sub?: string;
  regionId?: string;
  regionName?: string;
}

export interface MapDocOptions {
  /** Tâm bản đồ ban đầu. Tọa độ không hợp lệ → căn theo các điểm, hoặc khung nhìn mặc định. */
  center?: [number | null | undefined, number | null | undefined];
  points?: MapPoint[];
  radiusKm?: number;
  zoom?: number;
  interactivePick?: boolean;
  /**
   * Chế độ chọn vị trí: tọa độ ghim ban đầu. Mặc định = center.
   * null → chưa có vị trí, ghim chỉ xuất hiện khi người dùng chọn trên bản đồ.
   */
  pickPoint?: [number | null | undefined, number | null | undefined] | null;
  selectedRegionId?: string | null;
  selectedWarehouseCode?: string | null;
  pickHint?: string;
  pinTooltip?: string;
}

/**
 * Khung nhìn ban đầu khi chưa có tọa độ nào để hiển thị (TP. Hồ Chí Minh).
 * Chỉ dùng để đặt góc nhìn – không vẽ ghim, không trả về như một vị trí.
 */
const DEFAULT_VIEWPORT: [number, number] = [10.7769, 106.7009];
const DEFAULT_VIEWPORT_ZOOM = 11;

/** VietMap Street Map (Maps API, raster "tm", ảnh @2x 512px). */
const STREET_TILE_URL = 'https://maps.vietmap.vn/api/tm/{z}/{x}/{y}@2x.png?apikey=';

const toPair = (p?: [number | null | undefined, number | null | undefined] | null): [number, number] | null =>
  p && isValidCoordinate(p[0], p[1]) ? [Number(p[0]), Number(p[1])] : null;

/**
 * Tài liệu HTML cho iframe srcDoc: Leaflet + VietMap Street Map.
 * - Kho: chấm cam; Điểm bán: chấm xanh; vòng tròn bán kính phục vụ (nét đứt) quanh kho.
 * - Chế độ chọn vị trí: bấm hoặc kéo ghim → postMessage({ type: 'mapPick', lat, lng }) lên trang cha;
 *   trang cha gửi { type: 'setPoint', lat, lng } để di chuyển ghim mà không tải lại bản đồ.
 * - Điểm không có tọa độ hợp lệ không được vẽ (không dùng tọa độ thay thế).
 * - Không tải được bản đồ → hiển thị thông báo lỗi, không thay bằng bản đồ khác.
 */
export function buildMapDoc({
  center,
  points = [],
  radiusKm = 0,
  zoom = 13,
  interactivePick = false,
  pickPoint,
  selectedRegionId = null,
  selectedWarehouseCode = null,
  pickHint = 'Nhấp hoặc kéo ghim để chọn vị trí & đồng bộ địa chỉ',
  pinTooltip = 'Vị trí đang chọn (kéo ghim để đổi)',
}: MapDocOptions): string {
  const validPoints = points
    .filter((p) => isValidCoordinate(p.lat, p.lng))
    .map((p) => ({ ...p, lat: Number(p.lat), lng: Number(p.lng) }));

  let filteredPoints = validPoints;
  if (selectedWarehouseCode) {
    const codeUpper = selectedWarehouseCode.trim().toUpperCase();
    filteredPoints = validPoints.filter((p) => {
      if (p.kind === 'wh' || p.kind === 'central') {
        const labelUpper = p.label.toUpperCase();
        return labelUpper.startsWith(codeUpper) || labelUpper.includes(codeUpper);
      }
      return true; // Keep retailers for context
    });
  } else if (selectedRegionId) {
    filteredPoints = validPoints.filter((p) => {
      if (p.kind === 'wh' || p.kind === 'central') {
        return p.regionId === selectedRegionId;
      }
      return true;
    });
  }

  const whPoints = filteredPoints.filter((p) => p.kind === 'wh' || p.kind === 'central');
  const selectedCenter: [number, number] | null =
    (selectedWarehouseCode || selectedRegionId) && whPoints.length > 0 ? [whPoints[0].lat, whPoints[0].lng] : null;
  const pin = interactivePick ? toPair(pickPoint === undefined ? center : pickPoint) : null;
  const explicitCenter = selectedCenter ?? toPair(center) ?? pin;
  const effectiveCenter: [number, number] =
    explicitCenter ?? (filteredPoints[0] ? [filteredPoints[0].lat, filteredPoints[0].lng] : DEFAULT_VIEWPORT);
  const initialZoom = explicitCenter || filteredPoints.length ? (selectedWarehouseCode ? 13 : zoom) : DEFAULT_VIEWPORT_ZOOM;

  const json = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c');
  const radMeters = (radiusKm || 0) * 1000;
  const hasWh = filteredPoints.some((p) => p.kind === 'wh' || p.kind === 'central');
  const hasRet = filteredPoints.some((p) => p.kind === 'ret');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"/>
<style>
  html,body,#m{height:100%;margin:0;padding:0;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#EEF2EC}
  .lg{position:absolute;bottom:10px;left:10px;z-index:999;background:rgba(255,255,255,0.96);padding:6px 12px;border-radius:6px;border:1px solid #CBD5E1;font-size:11.5px;box-shadow:0 1px 3px rgba(0,0,0,.1);display:flex;gap:12px;align-items:center;flex-wrap:wrap;color:#1E293B}
  .pick-hint{color:#0D9488;font-weight:600}
  .st{position:absolute;inset:0;z-index:1000;display:none;align-items:center;justify-content:center;text-align:center;padding:16px;font-size:13px;color:#475569;background:#F1F5F9}
  .st.show{display:flex}
  .ld{position:absolute;top:10px;left:50%;transform:translateX(-50%);z-index:998;background:rgba(255,255,255,.95);border:1px solid #CBD5E1;border-radius:6px;padding:4px 10px;font-size:12px;color:#475569}
</style></head><body>
<div id="m"></div>
<div id="ld" class="ld">Đang tải bản đồ…</div>
<div id="st" class="st" role="status"><div>Không tải được bản đồ. Vui lòng thử lại sau.</div></div>

<div class="lg">
  ${hasWh || (!hasWh && !hasRet && !interactivePick) ? '<span><b style="color:#B85C1E">■</b> Kho</span>' : ''}
  ${hasRet || (!hasWh && !hasRet) ? '<span><b style="color:#1D4ED8">●</b> Điểm bán (Retailer)</span>' : ''}
  ${radiusKm > 0 ? `<span><span style="color:#0D9488;font-weight:700">◯</span> Bán kính ${radiusKm} km</span>` : ''}
  ${interactivePick ? `<span class="pick-hint">· ${escapeHtml(pickHint)}</span>` : ''}
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<script>
var C=${json(effectiveCenter)}, P=${json(filteredPoints)}, R=${radMeters}, Z=${initialZoom}, PICK=${interactivePick ? 'true' : 'false'};
var PIN=${json(pin)}, PIN_TIP=${json(pinTooltip)};
var TILE_URL=${json(env.vietmap.mapsKey ? STREET_TILE_URL + encodeURIComponent(env.vietmap.mapsKey) : '')};

var map=null, mk=null, centerCircle=null;
var CIRCLE_STYLE={radius:R,color:'#0D9488',weight:2,opacity:0.9,dashArray:'6, 6',fillColor:'#14B8A6',fillOpacity:0.12};

function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function failed(){document.getElementById('ld').style.display='none';document.getElementById('st').className='st show';}
function loaded(){document.getElementById('ld').style.display='none';}

function emitPick(lat,lng){
  var safeLat=Math.round(Number(lat)*10000)/10000;
  var safeLng=Math.round(Number(lng)*10000)/10000;
  window.parent.postMessage({type:'mapPick',lat:safeLat,lng:safeLng},'*');
}

function placePin(latlng){
  if(!map) return;
  if(!mk){
    mk=L.marker(latlng,{draggable:true,title:'Vị trí đang chọn'}).addTo(map);
    mk.bindTooltip(esc(PIN_TIP),{permanent:false,direction:'top'});
    mk.on('dragend',function(e){
      var p=e.target.getLatLng();
      if(centerCircle) centerCircle.setLatLng(p);
      emitPick(p.lat,p.lng);
    });
  } else {
    mk.setLatLng(latlng);
  }
  if(R>0){
    if(!centerCircle){
      centerCircle=L.circle(latlng,CIRCLE_STYLE).addTo(map);
      centerCircle.bindTooltip('Bán kính phục vụ '+Math.round(R/1000)+' km');
    } else {
      centerCircle.setLatLng(latlng);
    }
  }
}

window.addEventListener('message',function(ev){
  if(ev.source!==window.parent||!ev.data) return;
  if((ev.data.type==='setPoint'||ev.data.type==='fscm:set-center') && typeof ev.data.lat==='number' && typeof ev.data.lng==='number'){
    var la=ev.data.lat, ln=ev.data.lng;
    if(!isFinite(la)||!isFinite(ln)||Math.abs(la)>90||Math.abs(ln)>180) return;
    if(PICK) placePin([la,ln]);
    if(map) map.panTo([la,ln]);
  }
});

try{
  if(!window.L||!TILE_URL) throw 0;
  map=L.map('m',{zoomControl:true}).setView(C,Z);

  // 512px tiles + zoomOffset -1: same scale as 256px tiles, a quarter of the requests.
  var tl=L.tileLayer(TILE_URL,{
    tileSize:512, zoomOffset:-1, minZoom:3, maxZoom:20,
    attribution:'&copy; <a href="https://vietmap.vn" target="_blank" rel="noreferrer">VietMap</a>'
  }).addTo(map);
  var okTiles=0, badTiles=0;
  tl.on('tileload',function(){okTiles++; loaded();});
  tl.on('tileerror',function(){badTiles++; if(okTiles===0&&badTiles>=4) failed();});
  tl.on('load',loaded);

  var bounds=[];

  if(R>0){
    P.forEach(function(p){
      if(p.kind!=='wh'&&p.kind!=='central') return;
      var c=L.circle([p.lat,p.lng],CIRCLE_STYLE).addTo(map);
      c.bindTooltip('<b>Bán kính '+Math.round(R/1000)+' km:</b><br/>'+esc(p.label),{sticky:true});
    });
  }

  P.forEach(function(p){
    var isW=p.kind==='wh'||p.kind==='central';
    var radius=isW?9:7;
    var marker=L.circleMarker([p.lat,p.lng],{
      radius:radius, color:'#fff', weight:2, fillColor:isW?'#B85C1E':'#1D4ED8', fillOpacity:0.96
    }).addTo(map);
    var info='<b>'+(isW?'Kho: ':'Điểm bán: ')+esc(p.label)+'</b>';
    if(p.sub) info+='<br/>'+esc(p.sub);
    if(p.regionName) info+='<br/><span style="color:#0D9488;font-weight:600">Vùng: '+esc(p.regionName)+'</span>';
    info+='<br/><small>['+p.lat+', '+p.lng+']</small>';
    marker.bindPopup(info);
    marker.bindTooltip(esc(p.label),{permanent:true,direction:'top',offset:[0,-radius]});
    bounds.push([p.lat,p.lng]);
  });

  // Initial view without animation: an animated zoom started while the frame is still laying out
  // never finishes, and Leaflet then ignores the zoom buttons.
  if(!PICK){
    if(bounds.length>1){ try{ map.fitBounds(bounds,{padding:[40,40],maxZoom:14,animate:false}); }catch(e){} }
    else if(bounds.length===1){ map.setView(bounds[0],14,{animate:false}); }
  }

  if(PICK){
    map.getContainer().style.cursor='crosshair';
    if(PIN) placePin(PIN);
    map.on('click',function(e){
      placePin(e.latlng);
      emitPick(e.latlng.lat,e.latlng.lng);
    });
  }

  // Khung chứa đổi kích thước (modal, cột co giãn) → vẽ lại ô bản đồ.
  window.addEventListener('resize',function(){ map.invalidateSize(); });
  setTimeout(function(){ map.invalidateSize(); },0);
}catch(e){failed();}
</script></body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

export const buildWarehouseMapDoc = buildMapDoc;
