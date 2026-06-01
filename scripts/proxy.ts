import { ProxyAgent, setGlobalDispatcher } from "undici";

const proxy = process.env.https_proxy || process.env.HTTPS_PROXY;

if (proxy) {
  const agent = new ProxyAgent({ uri: new URL(proxy), requestTls: { rejectUnauthorized: false } });
  setGlobalDispatcher(agent);
  console.log(`[proxy] using ${proxy}\n`);
}
