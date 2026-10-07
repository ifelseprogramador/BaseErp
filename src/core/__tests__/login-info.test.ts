import { describe, expect, it } from "vitest";
import { describeDevice, extractClientInfo, formatLocation, isPrivateIp } from "../login-info";

const headers = (values: Record<string, string>) => ({
  get: (name: string) => values[name.toLowerCase()] ?? null,
});

describe("extractClientInfo", () => {
  it("pega o primeiro IP de x-forwarded-for e a localização da Vercel (decodificada)", () => {
    const info = extractClientInfo(
      headers({
        "x-forwarded-for": "177.1.2.3, 10.0.0.1",
        "x-vercel-ip-city": "S%C3%A3o%20Paulo",
        "x-vercel-ip-country-region": "SP",
        "x-vercel-ip-country": "BR",
        "user-agent": "Mozilla/5.0",
      }),
    );
    expect(info).toMatchObject({ ip: "177.1.2.3", city: "São Paulo", region: "SP", country: "BR" });
  });

  it("sem cabeçalhos de localização, tudo fica vazio (rodando local)", () => {
    const info = extractClientInfo(headers({ "x-real-ip": "127.0.0.1" }));
    expect(info).toMatchObject({ ip: "127.0.0.1", city: null, region: null, country: null });
    expect(formatLocation(info)).toBeNull();
  });

  it("país 'XX' da Cloudflare (desconhecido) é ignorado; cf-ipcountry vale como país", () => {
    expect(extractClientInfo(headers({ "cf-ipcountry": "XX" })).country).toBeNull();
    expect(extractClientInfo(headers({ "cf-ipcountry": "PT" })).country).toBe("PT");
  });
});

describe("isPrivateIp / formatLocation / describeDevice", () => {
  it("reconhece IPs de rede local", () => {
    for (const ip of ["127.0.0.1", "::1", "10.1.2.3", "192.168.0.9", "172.20.1.1"]) {
      expect(isPrivateIp(ip)).toBe(true);
    }
    expect(isPrivateIp("177.1.2.3")).toBe(false);
    expect(isPrivateIp(null)).toBe(false);
  });

  it("monta a localização com o que existir", () => {
    expect(formatLocation({ city: "Recife", region: "PE", country: "BR" })).toBe("Recife, PE, BR");
    expect(formatLocation({ city: null, region: null, country: "BR" })).toBe("BR");
  });

  it("resume o aparelho", () => {
    expect(
      describeDevice(
        "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/154.0 Mobile Safari/537.36",
      ),
    ).toBe("Chrome · Android");
    expect(describeDevice("Mozilla/5.0 (Windows NT 10.0) Gecko/20100101 Firefox/130.0")).toBe(
      "Firefox · Windows",
    );
    expect(describeDevice(null)).toBe("—");
  });
});
