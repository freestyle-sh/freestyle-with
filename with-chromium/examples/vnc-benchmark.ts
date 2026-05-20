import "dotenv/config";
import { freestyle, VmSpec } from "freestyle";
import { TigerVncBackend, X11VncBackend } from "@freestyle-sh/with-vnc";
import type { VncBackendDefinition } from "@freestyle-sh/with-type-vnc";
import { VmChromium } from "../src/index.ts";

type BenchmarkMetrics = {
  backend: string;
  vmId: string;
  width: number;
  height: number;
  bytesPerPixel: number;
  fullFrame: {
    samples: number;
    avgMs: number;
    minMs: number;
    maxMs: number;
    avgBytes: number;
    mbps: number;
  };
  incremental: {
    samples: number;
    avgMs: number;
    minMs: number;
    maxMs: number;
    avgBytes: number;
    mbps: number;
  };
};

const screen = {
  width: 1024,
  height: 768,
};

const backendByName: Record<string, () => VncBackendDefinition> = {
  x11vnc: () => new X11VncBackend(),
  tigervnc: () => new TigerVncBackend(),
};

const backends = (
  process.env.VNC_BACKENDS?.split(",").map((backend) => backend.trim()) ?? [
    "x11vnc",
    "tigervnc",
  ]
).map((name) => {
  const create = backendByName[name];
  if (!create) {
    throw new Error(`Unknown VNC backend: ${name}`);
  }

  return create();
});

const animatedPage = `data:text/html;charset=utf-8,${encodeURIComponent(`
  <!doctype html>
  <html>
    <head>
      <title>VNC Benchmark</title>
      <style>
        * { box-sizing: border-box; }
        body {
          margin: 0;
          min-height: 100vh;
          overflow: hidden;
          font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          color: #111111;
          background:
            linear-gradient(120deg, #87d7c5, #f4c95d, #f08a7a, #9fb4ff);
          background-size: 300% 300%;
          animation: bg 2.4s linear infinite;
        }
        main {
          display: grid;
          place-items: center;
          min-height: 100vh;
        }
        section {
          display: grid;
          gap: 18px;
          width: min(760px, calc(100vw - 80px));
          padding: 36px;
          border: 3px solid #111111;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.86);
        }
        h1 {
          margin: 0;
          font-size: 56px;
          letter-spacing: 0;
        }
        .bar {
          height: 42px;
          border: 2px solid #111111;
          border-radius: 6px;
          background: #202124;
          transform-origin: left center;
          animation: pulse 0.72s ease-in-out infinite alternate;
        }
        .tiles {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 10px;
        }
        .tiles span {
          aspect-ratio: 1;
          border: 2px solid #111111;
          border-radius: 6px;
          animation: tile 1.2s linear infinite;
        }
        @keyframes bg {
          from { background-position: 0% 50%; }
          to { background-position: 100% 50%; }
        }
        @keyframes pulse {
          from { transform: scaleX(0.15); }
          to { transform: scaleX(1); }
        }
        @keyframes tile {
          0% { background: #ffffff; }
          50% { background: #202124; }
          100% { background: #ffffff; }
        }
      </style>
    </head>
    <body>
      <main>
        <section>
          <h1>VNC Benchmark</h1>
          <div class="bar"></div>
          <div class="tiles">
            <span></span><span></span><span></span><span></span><span></span><span></span>
            <span></span><span></span><span></span><span></span><span></span><span></span>
          </div>
        </section>
      </main>
    </body>
  </html>
`)}`;

const rfbBenchmarkPy = String.raw`
import json
import socket
import statistics
import struct
import sys
import time

host = sys.argv[1]
port = int(sys.argv[2])
full_samples = int(sys.argv[3])
incremental_samples = int(sys.argv[4])

sock = socket.create_connection((host, port), timeout=10)
sock.settimeout(10)

def recvn(count):
    chunks = []
    remaining = count
    while remaining:
        chunk = sock.recv(remaining)
        if not chunk:
            raise RuntimeError("socket closed")
        chunks.append(chunk)
        remaining -= len(chunk)
    return b"".join(chunks)

def read_u8():
    return recvn(1)[0]

protocol = recvn(12)
sock.sendall(protocol)

if protocol.startswith(b"RFB 003.003"):
    security_type = struct.unpack(">I", recvn(4))[0]
    if security_type != 1:
        raise RuntimeError(f"unsupported security type {security_type}")
else:
    count = read_u8()
    security_types = recvn(count)
    if 1 not in security_types:
        raise RuntimeError(f"server does not offer None security: {list(security_types)}")
    sock.sendall(b"\x01")
    security_result = struct.unpack(">I", recvn(4))[0]
    if security_result != 0:
        raise RuntimeError(f"security failed: {security_result}")

sock.sendall(b"\x01")
server_init = recvn(24)
width, height = struct.unpack(">HH", server_init[:4])
bits_per_pixel = server_init[4]
bytes_per_pixel = bits_per_pixel // 8
name_length = struct.unpack(">I", server_init[20:24])[0]
if name_length:
    recvn(name_length)

sock.sendall(struct.pack(">BBH", 2, 0, 1) + struct.pack(">i", 0))

def request_frame(incremental):
    sock.sendall(struct.pack(">BBHHHH", 3, incremental, 0, 0, width, height))

def read_update():
    while True:
        message_type = read_u8()
        if message_type == 0:
            break
        if message_type == 2:
            continue
        if message_type == 3:
            recvn(3)
            length = struct.unpack(">I", recvn(4))[0]
            recvn(length)
            continue
        raise RuntimeError(f"unexpected server message {message_type}")

    recvn(1)
    rectangle_count = struct.unpack(">H", recvn(2))[0]
    total_bytes = 0

    for _ in range(rectangle_count):
        x, y, rect_width, rect_height, encoding = struct.unpack(">HHHHi", recvn(12))
        if encoding == 0:
            byte_count = rect_width * rect_height * bytes_per_pixel
            recvn(byte_count)
            total_bytes += byte_count
        elif encoding == -223:
            pass
        else:
            raise RuntimeError(f"unexpected encoding {encoding}")

    return total_bytes

def sample(incremental, count):
    timings = []
    byte_counts = []
    for _ in range(count):
        request_frame(1 if incremental else 0)
        started_at = time.perf_counter()
        byte_counts.append(read_update())
        timings.append((time.perf_counter() - started_at) * 1000)
        time.sleep(0.08)
    return timings, byte_counts

full_timings, full_bytes = sample(False, full_samples)
incremental_timings, incremental_bytes = sample(True, incremental_samples)

def summarize(timings, byte_counts):
    avg_ms = statistics.mean(timings)
    avg_bytes = statistics.mean(byte_counts)
    return {
        "samples": len(timings),
        "avgMs": avg_ms,
        "minMs": min(timings),
        "maxMs": max(timings),
        "avgBytes": avg_bytes,
        "mbps": ((avg_bytes * 8) / (avg_ms / 1000)) / 1_000_000 if avg_ms else 0,
    }

print(json.dumps({
    "width": width,
    "height": height,
    "bytesPerPixel": bytes_per_pixel,
    "fullFrame": summarize(full_timings, full_bytes),
    "incremental": summarize(incremental_timings, incremental_bytes),
}))
`;

const shellQuote = (value: string): string => {
  return `'${value.replace(/'/g, "'\\''")}'`;
};

const benchmarkCommand = (port: number): string => {
  return [
    "python3",
    "-c",
    shellQuote(rfbBenchmarkPy),
    "127.0.0.1",
    String(port),
    String(Number(process.env.VNC_FULL_SAMPLES ?? 5)),
    String(Number(process.env.VNC_INCREMENTAL_SAMPLES ?? 16)),
  ].join(" ");
};

const waitForPortCommand = (port: number): string => {
  const script = String.raw`
import socket
import sys
import time

host = sys.argv[1]
port = int(sys.argv[2])
deadline = time.time() + 60
last_error = None

while time.time() < deadline:
    try:
        sock = socket.create_connection((host, port), timeout=1)
        sock.close()
        sys.exit(0)
    except Exception as error:
        last_error = error
        time.sleep(1)

print(last_error, file=sys.stderr)
sys.exit(1)
`;

  return ["python3", "-c", shellQuote(script), "127.0.0.1", String(port)].join(
    " ",
  );
};

const runBackend = async (
  backend: VncBackendDefinition,
): Promise<BenchmarkMetrics> => {
  let vmId: string | undefined;

  try {
    const { vm, vmId: createdVmId } = await freestyle.vms.create(
      new VmSpec({
        idleTimeoutSeconds: 180,
        with: {
          chromium: new VmChromium({
            mode: "headed",
            enableVnc: true,
            vncBackend: backend,
            homepage: animatedPage,
            screen,
          }),
        },
      }),
    );
    vmId = createdVmId;

    const ready = await vm.exec({
      command: "curl -fsS http://127.0.0.1:6080/vnc.html >/dev/null",
    });
    if (ready.statusCode !== 0) {
      throw new Error(
        `noVNC did not start for ${backend.name}:\n${ready.stdout ?? ""}\n${
          ready.stderr ?? ""
        }`,
      );
    }

    const rfbReady = await vm.exec({
      command: waitForPortCommand(vm.chromium.vncPort()),
    });
    if (rfbReady.statusCode !== 0) {
      const logs = await vm.chromium.logs({ unit: "chromium-vnc", lines: 80 });
      throw new Error(
        `VNC backend did not open port ${vm.chromium.vncPort()} for ${
          backend.name
        }:\n${rfbReady.stdout ?? ""}\n${rfbReady.stderr ?? ""}\n${logs.join(
          "\n",
        )}`,
      );
    }

    const result = await vm.exec({
      command: benchmarkCommand(vm.chromium.vncPort()),
    });
    if (result.statusCode !== 0) {
      throw new Error(
        `benchmark failed for ${backend.name}:\n${result.stdout ?? ""}\n${
          result.stderr ?? ""
        }`,
      );
    }

    return {
      backend: backend.name,
      vmId,
      ...(JSON.parse(result.stdout ?? "{}") as Omit<
        BenchmarkMetrics,
        "backend" | "vmId"
      >),
    };
  } finally {
    if (vmId && process.env.KEEP_VMS !== "1") {
      await freestyle.vms.delete({ vmId });
    }
  }
};

const results: BenchmarkMetrics[] = [];

for (const backend of backends) {
  console.log(`Benchmarking ${backend.name}...`);
  const metrics = await runBackend(backend);
  results.push(metrics);
  console.log(JSON.stringify(metrics, null, 2));
}

console.log("\nSummary");
console.table(
  results.map((result) => ({
    backend: result.backend,
    vmId: result.vmId,
    size: `${result.width}x${result.height}`,
    fullAvgMs: result.fullFrame.avgMs.toFixed(1),
    fullMbps: result.fullFrame.mbps.toFixed(1),
    incAvgMs: result.incremental.avgMs.toFixed(1),
    incAvgBytes: Math.round(result.incremental.avgBytes),
    incMbps: result.incremental.mbps.toFixed(1),
  })),
);
