import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import test from "node:test";

import express from "express";

import { createApp } from "../../src/app.js";
import { subscriptionTokenRateLimit } from "../../src/middlewares/rate-limit.js";

async function startServer() {
  const app = createApp();
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");

  return {
    server,
    port: server.address().port
  };
}

async function startStandaloneServer(configureApp) {
  const app = express();
  app.use(express.json());
  configureApp(app);

  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");

  return {
    server,
    port: server.address().port
  };
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function requestWithCustomHost(port, host) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: "/api/health",
        method: "GET",
        headers: {
          Host: host
        }
      },
      (response) => {
        let rawBody = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          rawBody += chunk;
        });
        response.on("end", () => {
          resolve({
            statusCode: response.statusCode ?? 0,
            body: rawBody
          });
        });
      }
    );

    request.on("error", reject);
    request.end();
  });
}

test("rechaza origenes no permitidos sin responder 500", async (t) => {
  const { server, port } = await startServer();
  t.after(async () => {
    await closeServer(server);
  });

  const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
    headers: {
      Origin: "http://evil.example"
    }
  });

  assert.equal(response.status, 403);
  const body = await response.json();
  assert.match(body.message, /Origen no permitido/i);
});

test("rechaza hosts no permitidos", async (t) => {
  const { server, port } = await startServer();
  t.after(async () => {
    await closeServer(server);
  });

  const response = await requestWithCustomHost(port, "poisoned.local");
  assert.equal(response.statusCode, 400);
  assert.match(response.body, /Host no permitido/i);
});

test("limita intentos repetidos sobre enlaces de confirmar o salir del boletin", async (t) => {
  const { server, port } = await startStandaloneServer((app) => {
    app.post("/token-action", subscriptionTokenRateLimit, (_req, res) => {
      res.json({ ok: true });
    });
  });

  t.after(async () => {
    await closeServer(server);
  });

  for (let index = 0; index < 12; index += 1) {
    const response = await fetch(`http://127.0.0.1:${port}/token-action`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ token: "a".repeat(24) })
    });

    assert.equal(response.status, 200);
  }

  const blockedResponse = await fetch(`http://127.0.0.1:${port}/token-action`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ token: "a".repeat(24) })
  });

  assert.equal(blockedResponse.status, 429);
  const payload = await blockedResponse.json();
  assert.match(payload.message, /boletin/i);
});
