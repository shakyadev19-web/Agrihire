(() => {
  const FALLBACK = { lat: 27.49, lon: 77.67 };   // used if location is denied
  const CACHE_MINUTES = 15;
  const RAIN_ALERT_PERCENT = 60;

  const $ = id => document.getElementById(id);

  // Optional URL params: weather.html?date=2026-10-27&lat=27.18&lon=78.02
  const params = new URLSearchParams(location.search);
  const bookingDate = params.get("date") || localStorage.getItem("date") || null;   // YYYY-MM-DD or null (= today)

  function iconFor(c) {
    if (c === 0) return "☀️";
    if (c === 1) return "🌤️";
    if (c === 2) return "⛅";
    if (c === 3) return "☁️";
    if (c === 45 || c === 48) return "🌫️";
    if (c >= 51 && c <= 57) return "🌦️";
    if (c >= 61 && c <= 67) return "🌧️";
    if (c >= 71 && c <= 77) return "❄️";
    if (c >= 80 && c <= 82) return "🌧️";
    if (c >= 95) return "⛈️";
    return "🌡️";
  }

  function getLocation() {
    const lat = parseFloat(params.get("lat") || localStorage.getItem("la"));   // URL first, then saved location
    const lon = parseFloat(params.get("lon") || localStorage.getItem("lo"));
    if (!isNaN(lat) && !isNaN(lon)) return Promise.resolve({ lat, lon });

    return new Promise(resolve => {
      if (!navigator.geolocation) return resolve(FALLBACK);
      navigator.geolocation.getCurrentPosition(
        p => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
        () => resolve(FALLBACK),
        { timeout: 6000 }
      );
    });
  }

  async function fetchWeather({ lat, lon }) {
    const key = `wx_${lat.toFixed(2)}_${lon.toFixed(2)}`;
    try {
      const cached = JSON.parse(sessionStorage.getItem(key));
      if (cached && Date.now() - cached.time < CACHE_MINUTES * 60000) return cached.data;
    } catch (e) {}

    const url = "https://api.open-meteo.com/v1/forecast" +
      `?latitude=${lat}&longitude=${lon}` +
      "&daily=weather_code,temperature_2m_max,precipitation_probability_max,precipitation_sum" +
      "&timezone=auto&forecast_days=16";

    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();

    try { sessionStorage.setItem(key, JSON.stringify({ time: Date.now(), data })); } catch (e) {}
    return data;
  }

  function dayName(dateStr) {
    return new Date(dateStr + "T00:00:00").toLocaleDateString(localStorage.getItem("lang") === "hi" ? "hi-IN" : "en-IN", { weekday: "short" });
  }

  // Fill a bar card with the forecast values (replaces the "Loading…" text)
  function fillBars(card, dates, values, selIndex) {
    card.querySelectorAll(".row, .empty").forEach(r => r.remove());
    const max = Math.max(...values, 1);
    const rows = values.map((v, i) => `
      <div class="row${i === selIndex ? " sel" : ""}">
        <span>${dayName(dates[i])}</span>
        <div style="flex:1"><i style="width:${Math.round((v / max) * 100)}%"></i></div>
        <b>${Math.round(v)}</b>
      </div>`).join("");
    card.insertAdjacentHTML("beforeend", rows);
  }

  function render(data) {
    const d = data.daily;

    // Which day is the booking day? Fall back to today if out of range
    let sel = bookingDate ? d.time.indexOf(bookingDate) : 0;
    if (sel < 0) sel = 0;

    const rain = (d.precipitation_probability_max[sel] || 0);

    $("t").textContent = Math.round(d.temperature_2m_max[sel]);
    $("r").textContent = rain;
    document.querySelector(".card .ic").textContent = iconFor(d.weather_code[sel]);

    // Rain alert
    $("wxa").hidden = !(rain >= RAIN_ALERT_PERCENT || d.precipitation_sum[sel] >= 5);

    // Bar charts: first 5 days
    const start = Math.max(0, Math.min(sel - 2, d.time.length - 5));
    const dates = d.time.slice(start, start + 5);
    const rainVals = d.precipitation_probability_max.slice(start, start + 5).map(v => v || 0);
    const tempVals = d.temperature_2m_max.slice(start, start + 5);
    const [rainCard, tempCard] = document.querySelectorAll(".card.bars");
    if (rainCard) fillBars(rainCard, dates, rainVals, sel - start);
    if (tempCard) fillBars(tempCard, dates, tempVals, sel - start);
  }

  async function init() {
    try {
      const loc = await getLocation();
      render(await fetchWeather(loc));
    } catch (err) {
      console.error("Weather failed:", err);
      $("t").textContent = "--";
      $("r").textContent = "--";
    }
  }

  init();
})();