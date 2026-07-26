import assert from "node:assert/strict";
import test from "node:test";

import { env } from "../../src/config/env.js";
import { signAuthToken } from "../../src/lib/auth.js";
import { attachCurrentUser } from "../../src/middlewares/auth.js";
import { User } from "../../src/models/User.js";

function createToken(userId, sessionVersion) {
  return signAuthToken({
    _id: {
      toString() {
        return userId;
      }
    },
    role: "admin",
    sessionVersion
  });
}

test("invalida sesiones emitidas antes de un cambio de contrasena", async (t) => {
  const originalFindById = User.findById;

  User.findById = async () => ({
    _id: "admin-1",
    role: "admin",
    status: "active",
    sessionVersion: 2
  });

  t.after(() => {
    User.findById = originalFindById;
  });

  const request = {
    cookies: {
      [env.cookieName]: createToken("admin-1", 1)
    },
    app: {
      locals: {
        cookieName: env.cookieName
      }
    },
    headers: {}
  };

  await attachCurrentUser(request, {}, () => {});

  assert.equal(request.user, undefined);
});

test("acepta la sesion cuando la version coincide con el usuario actual", async (t) => {
  const originalFindById = User.findById;

  User.findById = async () => ({
    _id: "admin-1",
    role: "admin",
    status: "active",
    sessionVersion: 2
  });

  t.after(() => {
    User.findById = originalFindById;
  });

  const request = {
    cookies: {
      [env.cookieName]: createToken("admin-1", 2)
    },
    app: {
      locals: {
        cookieName: env.cookieName
      }
    },
    headers: {}
  };

  await attachCurrentUser(request, {}, () => {});

  assert.equal(request.user?.role, "admin");
});
