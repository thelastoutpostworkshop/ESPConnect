import { afterEach, describe, expect, it, vi } from "vitest";
import { ESPLoader } from "tasmota-webserial-esptool";
import {
  createEsptoolClient,
  type StatusPayload,
} from "../src/services/esptoolClient";
import { FakeSerialPort, loadTranscript } from "./helpers/esptool-transcript";

type StatusCapture = {
  statuses: StatusPayload[];
  onStatus: (payload: StatusPayload) => void;
};

const createStatusCapture = (): StatusCapture => {
  const statuses: StatusPayload[] = [];
  return {
    statuses,
    onStatus: payload => statuses.push(payload),
  };
};

const createTerminal = () => ({
  lines: [] as string[],
  writeLine(line: string) {
    this.lines.push(line);
  },
});

let runStubSpy: ReturnType<typeof vi.spyOn> | null = null;

const ensureStubSkipped = () => {
  if (!runStubSpy) {
    runStubSpy = vi
      .spyOn(ESPLoader.prototype, "runStub")
      .mockImplementation(function () {
        return Promise.resolve(this as unknown as ESPLoader);
      });
  }
};

const createClient = (
  transcriptName: string,
  options?: { desiredBaud?: number; skipStub?: boolean },
) => {
  if (options?.skipStub) {
    ensureStubSkipped();
  }
  const port = new FakeSerialPort(loadTranscript(transcriptName));
  const terminal = createTerminal();
  const { statuses, onStatus } = createStatusCapture();
  const client = createEsptoolClient({
    port: port as unknown as SerialPort,
    terminal,
    desiredBaud: options?.desiredBaud,
    debugSerial: false,
    debugLogging: false,
    onStatus,
  });
  return { client, port, statuses };
};

afterEach(() => {
  runStubSpy?.mockRestore();
  runStubSpy = null;
  vi.useRealTimers();
});

describe("tasmota-webserial-esptool wrapper contract", () => {
  it("connectAndHandshake reports status order and returns expected shape", async () => {
    const { client, port, statuses } = createClient("handshake", {
      desiredBaud: 921600,
      skipStub: true,
    });

    expect(statuses[0]).toMatchObject({
      message: "tasmota-webserial-esptool v(7.3.10) [ESP32-S31 compatibility patch active]",
      showInDialog: false,
    });

    const result = await client.connectAndHandshake();

    const statusKeys = statuses
      .map(status => status.translationKey)
      .filter((key): key is string => Boolean(key));
    expect(statusKeys).toEqual([
      "dialogs.openingSerialPort",
      "dialogs.handshakingBootloader",
      "dialogs.loadingStubFlasher",
      "dialogs.gettingSecurityInfo",
    ]);

    expect(result).toMatchObject({
      chipName: "ESP32-S3",
      macAddress: "34:85:18:95:6b:4c",
      flashSize: null,
    });
    expect(result.securityFacts.length).toBeGreaterThan(0);

    port.assertNoPendingSteps();
    await port.close();
  });

  it("connectAndHandshake completes with stub upload transcript", async () => {
    const { client, port } = createClient("handshake-stub-s3", {
      desiredBaud: 921600,
    });

    const result = await client.connectAndHandshake();

    expect(result).toMatchObject({
      chipName: "ESP32-S3",
      macAddress: "34:85:18:95:6b:4c",
    });

    port.assertNoPendingSteps();
    await port.close();
  });

  it("reads flash data and returns md5 checksum", async () => {
    const { client, port } = createClient("handshake-stub-s3-readflash", {
      desiredBaud: 921600,
    });

    await client.connectAndHandshake();

    const transcript = loadTranscript("handshake-stub-s3-readflash");
    const rawHex = transcript.steps
      .filter(
        step => step.type === "raw" && step.data.length > 8,
      )
      .map(step => step.data.toLowerCase())
      .join("");
    const expectedSize = rawHex.length / 2;

    const data = await client.loader.readFlash(0, expectedSize);
    expect(Buffer.from(data).toString("hex")).toBe(rawHex);

    const md5 = await client.flashMd5sum(0, expectedSize);
    expect(md5).toBe("000102030405060708090a0b0c0d0e0f");

    port.assertNoPendingSteps();
    await port.close();
  });

  it("syncWithStub reports reconnecting status and completes", async () => {
    const { client, port, statuses } = createClient("handshake-reconnect", {
      desiredBaud: 921600,
      skipStub: true,
    });

    await client.connectAndHandshake();
    await client.syncWithStub();

    const reconnectStatus = statuses.find(
      status => status.translationKey === "dialogs.reconnectingStub",
    );
    expect(reconnectStatus).toBeTruthy();

    port.assertNoPendingSteps();
    await port.close();
  });

  it("timeout transcript maps to a SlipReadError", async () => {
    vi.useFakeTimers();
    const { client, port } = createClient("handshake-timeout", {
      desiredBaud: 921600,
      skipStub: true,
    });

    const promise = client.connectAndHandshake();
    const assertion = expect(promise).rejects.toMatchObject({
      name: "SlipReadError",
      message: expect.stringContaining("Timed out"),
    });
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;

    port.assertNoPendingSteps();
    await port.close();
  });
});
