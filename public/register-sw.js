if ("serviceWorker" in navigator && !location.hostname.includes("localhost")) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
