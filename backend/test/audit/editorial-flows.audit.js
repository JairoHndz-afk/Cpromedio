import assert from "node:assert/strict";
import test from "node:test";

import { env } from "../../src/config/env.js";
import { deleteDashboardArticle, deleteUser, moderateArticle, submitArticleForReview, updateSubscription } from "../../src/controllers/dashboard.controller.js";
import {
  confirmPublicSubscription,
  createPublicSubscription,
  dispatchPublishedArticleBulletin,
  getPublicArticle,
  listPublicArticles,
  reactivatePublicSubscription,
  unsubscribePublicSubscription
} from "../../src/controllers/public.controller.js";
import { clearFeaturedArticleSelection } from "../../src/lib/site-settings.js";
import { AuditLog } from "../../src/models/AuditLog.js";
import { Article } from "../../src/models/Article.js";
import { ArticleView } from "../../src/models/ArticleView.js";
import { SiteSetting } from "../../src/models/SiteSetting.js";
import { Subscription } from "../../src/models/Subscription.js";
import { User } from "../../src/models/User.js";

function createMockResponse() {
  return {
    statusCode: 200,
    payload: null,
    cookies: [],
    status(code) {
      this.statusCode = code;
      return this;
    },
    cookie(name, value, options) {
      this.cookies.push({ name, value, options });
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    }
  };
}

function createMockRequest(overrides = {}) {
  const request = {
    body: {},
    params: {},
    headers: {},
    ip: "127.0.0.1",
    user: {
      _id: "admin-1",
      email: "admin@periodico.local",
      role: "admin"
    },
    ...overrides
  };

  request.get = (headerName) => {
    const key = String(headerName ?? "").toLowerCase();
    const value = request.headers?.[key] ?? request.headers?.[headerName];

    if (Array.isArray(value)) {
      return value.join(", ");
    }

    return value ?? "";
  };

  return request;
}

function createMockObjectId(value) {
  return {
    toString() {
      return value;
    }
  };
}

test("audita que una suscripcion no quede persistida en pending si falla el correo de confirmacion", async (t) => {
  const originalMailConfigured = env.mailConfigured;
  const originalSmtpHost = env.smtpHost;
  const originalSmtpPort = env.smtpPort;
  const originalSmtpUser = env.smtpUser;
  const originalSmtpPass = env.smtpPass;
  const originalNewsletterRequireConfirm = env.newsletterRequireConfirm;
  const originalFindOne = Subscription.findOne;
  const originalSave = Subscription.prototype.save;
  const originalDeleteOne = Subscription.deleteOne;

  env.mailConfigured = true;
  env.smtpHost = "127.0.0.1";
  env.smtpPort = 1;
  env.smtpUser = "usuario";
  env.smtpPass = "secreto";
  env.newsletterRequireConfirm = true;

  const savedSnapshots = [];
  let deleteCalls = 0;
  Subscription.findOne = async () => null;
  Subscription.prototype.save = async function saveSubscriptionSnapshot() {
    savedSnapshots.push({
      status: this.status,
      confirmationTokenHash: this.confirmationTokenHash,
      confirmationTokenExpiresAt: this.confirmationTokenExpiresAt
    });
    return this;
  };
  Subscription.deleteOne = async () => {
    deleteCalls += 1;
    return { acknowledged: true, deletedCount: 1 };
  };

  t.after(() => {
    env.mailConfigured = originalMailConfigured;
    env.smtpHost = originalSmtpHost;
    env.smtpPort = originalSmtpPort;
    env.smtpUser = originalSmtpUser;
    env.smtpPass = originalSmtpPass;
    env.newsletterRequireConfirm = originalNewsletterRequireConfirm;
    Subscription.findOne = originalFindOne;
    Subscription.prototype.save = originalSave;
    Subscription.deleteOne = originalDeleteOne;
  });

  const request = createMockRequest({
    body: {
      name: "Lector Auditoria",
      email: "lector-auditoria@example.com",
      plan: "newsletter",
      interests: []
    }
  });
  const response = createMockResponse();
  let capturedError = null;

  await createPublicSubscription(request, response, (error) => {
    capturedError = error;
  });

  assert.ok(capturedError, "La prueba debe forzar una falla de correo.");
  assert.equal(capturedError.status, 502);
  assert.equal(savedSnapshots.length, 1);
  assert.equal(savedSnapshots[0].status, "pending");
  assert.equal(
    deleteCalls,
    1,
    "Si el correo falla despues de persistir una alta nueva, la suscripcion debe revertirse para no dejar registros colgados."
  );
});

test("audita que una suscripcion activa no pueda ser alterada desde el formulario publico solo con conocer el correo", async (t) => {
  const originalFindOne = Subscription.findOne;

  let saveCalled = false;
  const activeSubscription = {
    _id: createMockObjectId("subscription-active"),
    name: "Lector original",
    email: "lector@example.com",
    plan: "newsletter",
    status: "active",
    interests: ["archivo"],
    source: "site",
    confirmationTokenHash: "",
    confirmationTokenExpiresAt: null,
    unsubscribeTokenHash: "hash",
    confirmedAt: new Date("2026-07-24T00:00:00.000Z"),
    welcomeSentAt: new Date("2026-07-24T00:00:00.000Z"),
    async save() {
      saveCalled = true;
      return this;
    }
  };

  Subscription.findOne = async () => activeSubscription;

  t.after(() => {
    Subscription.findOne = originalFindOne;
  });

  const request = createMockRequest({
    body: {
      name: "Nombre malicioso",
      email: "lector@example.com",
      plan: "premium",
      interests: ["intrusion"]
    }
  });
  const response = createMockResponse();

  await createPublicSubscription(request, response, (error) => {
    throw error;
  });

  assert.equal(response.statusCode, 202);
  assert.equal(saveCalled, false);
  assert.deepEqual(Object.keys(response.payload).sort(), ["message"]);
  assert.equal(activeSubscription.name, "Lector original");
  assert.equal(activeSubscription.plan, "newsletter");
  assert.deepEqual(activeSubscription.interests, ["archivo"]);
});

test("audita que la activacion manual de suscripciones limpie tokens de confirmacion pendientes", async (t) => {
  const originalFindById = Subscription.findById;
  const originalAuditCreate = AuditLog.create;

  const pendingSubscription = {
    _id: createMockObjectId("subscription-1"),
    name: "Lector",
    email: "lector@example.com",
    plan: "newsletter",
    status: "pending",
    interests: [],
    confirmationTokenHash: "token-aun-vigente",
    confirmationTokenExpiresAt: new Date("2026-08-01T00:00:00.000Z"),
    confirmedAt: null,
    createdAt: new Date("2026-07-24T00:00:00.000Z"),
    async save() {
      return this;
    }
  };

  Subscription.findById = async () => pendingSubscription;
  AuditLog.create = async () => ({});

  t.after(() => {
    Subscription.findById = originalFindById;
    AuditLog.create = originalAuditCreate;
  });

  const request = createMockRequest({
    params: { subscriptionId: "subscription-1" },
    body: { status: "active" }
  });
  const response = createMockResponse();

  await updateSubscription(request, response, (error) => {
    throw error;
  });

  assert.equal(response.statusCode, 200);
  assert.equal(
    pendingSubscription.confirmationTokenHash,
    "",
    "Al activar manualmente una suscripcion, el token de confirmacion pendiente debe invalidarse."
  );
  assert.equal(
    pendingSubscription.confirmationTokenExpiresAt,
    null,
    "Al activar manualmente una suscripcion, la expiracion del token tambien debe limpiarse."
  );
});

test("audita que pausar una suscripcion invalide cualquier token publico pendiente", async (t) => {
  const originalFindById = Subscription.findById;
  const originalAuditCreate = AuditLog.create;

  const pausedSubscription = {
    _id: createMockObjectId("subscription-paused"),
    name: "Lector pausado",
    email: "pausado@example.com",
    plan: "newsletter",
    status: "pending",
    interests: ["actualidad"],
    confirmationTokenHash: "token-activo",
    confirmationTokenExpiresAt: new Date("2026-08-01T00:00:00.000Z"),
    confirmedAt: null,
    createdAt: new Date("2026-07-24T00:00:00.000Z"),
    async save() {
      return this;
    }
  };

  Subscription.findById = async () => pausedSubscription;
  AuditLog.create = async () => ({});

  t.after(() => {
    Subscription.findById = originalFindById;
    AuditLog.create = originalAuditCreate;
  });

  const request = createMockRequest({
    params: { subscriptionId: "subscription-paused" },
    body: { status: "paused" }
  });
  const response = createMockResponse();

  await updateSubscription(request, response, (error) => {
    throw error;
  });

  assert.equal(response.statusCode, 200);
  assert.equal(pausedSubscription.status, "paused");
  assert.equal(pausedSubscription.confirmationTokenHash, "");
  assert.equal(pausedSubscription.confirmationTokenExpiresAt, null);
});

test("audita que una suscripcion pausada no pueda reactivarse desde el formulario publico", async (t) => {
  const originalFindOne = Subscription.findOne;

  let saveCalled = false;
  const pausedSubscription = {
    _id: createMockObjectId("subscription-locked"),
    name: "Lector bloqueado",
    email: "lector-bloqueado@example.com",
    plan: "newsletter",
    status: "paused",
    interests: ["archivo"],
    source: "site",
    confirmationTokenHash: "",
    confirmationTokenExpiresAt: null,
    unsubscribeTokenHash: "hash",
    confirmedAt: new Date("2026-07-24T00:00:00.000Z"),
    welcomeSentAt: new Date("2026-07-24T00:00:00.000Z"),
    async save() {
      saveCalled = true;
      return this;
    }
  };

  Subscription.findOne = async () => pausedSubscription;

  t.after(() => {
    Subscription.findOne = originalFindOne;
  });

  const request = createMockRequest({
    body: {
      name: "Intento externo",
      email: "lector-bloqueado@example.com",
      plan: "newsletter",
      interests: ["intrusion"]
    }
  });
  const response = createMockResponse();

  await createPublicSubscription(request, response, (error) => {
    throw error;
  });

  assert.equal(response.statusCode, 202);
  assert.equal(saveCalled, false);
  assert.equal(pausedSubscription.status, "paused");
  assert.deepEqual(pausedSubscription.interests, ["archivo"]);
});

test("audita que un token de confirmacion no reactive suscripciones fuera del estado pending", async (t) => {
  const originalFindOne = Subscription.findOne;

  let saveCalled = false;
  const pausedSubscription = {
    _id: createMockObjectId("subscription-confirm-paused"),
    name: "Lector pausado",
    email: "pausado-confirm@example.com",
    plan: "newsletter",
    status: "paused",
    interests: [],
    confirmationTokenHash: "token-paused",
    confirmationTokenExpiresAt: new Date("2026-08-01T00:00:00.000Z"),
    unsubscribeTokenHash: "hash",
    confirmedAt: new Date("2026-07-24T00:00:00.000Z"),
    welcomeSentAt: new Date("2026-07-24T00:00:00.000Z"),
    async save() {
      saveCalled = true;
      return this;
    }
  };

  Subscription.findOne = async () => pausedSubscription;

  t.after(() => {
    Subscription.findOne = originalFindOne;
  });

  const request = createMockRequest({
    body: {
      token: "token-publico-de-prueba-1234"
    }
  });
  const response = createMockResponse();
  let capturedError = null;

  await confirmPublicSubscription(request, response, (error) => {
    capturedError = error;
  });

  assert.ok(capturedError);
  assert.equal(capturedError.status, 409);
  assert.equal(saveCalled, false);
  assert.equal(pausedSubscription.status, "paused");
});

test("audita que cancelar una suscripcion deje listo un enlace de reactivacion", async (t) => {
  const originalFindOne = Subscription.findOne;
  const originalMailConfigured = env.mailConfigured;
  const originalAuditCreate = AuditLog.create;
  const originalConsoleInfo = console.info;

  let saveCalls = 0;
  const subscription = {
    _id: createMockObjectId("subscription-cancelled"),
    name: "Lector cancelado",
    email: "cancelado@example.com",
    plan: "newsletter",
    status: "active",
    interests: ["actualidad"],
    source: "site",
    confirmationTokenHash: "",
    confirmationTokenExpiresAt: null,
    unsubscribeTokenHash: "hash-anterior",
    confirmedAt: new Date("2026-07-24T00:00:00.000Z"),
    welcomeSentAt: new Date("2026-07-24T00:00:00.000Z"),
    async save() {
      saveCalls += 1;
      return this;
    }
  };

  Subscription.findOne = async () => subscription;
  env.mailConfigured = false;
  AuditLog.create = async () => ({});
  console.info = () => {};

  t.after(() => {
    Subscription.findOne = originalFindOne;
    env.mailConfigured = originalMailConfigured;
    AuditLog.create = originalAuditCreate;
    console.info = originalConsoleInfo;
  });

  const request = createMockRequest({
    body: {
      token: "token-de-salida-publico-1234567890"
    }
  });
  const response = createMockResponse();

  await unsubscribePublicSubscription(request, response, (error) => {
    throw error;
  });

  assert.equal(response.statusCode, 200);
  assert.equal(saveCalls, 1);
  assert.equal(subscription.status, "cancelled");
  assert.notEqual(subscription.confirmationTokenHash, "");
  assert.ok(subscription.confirmationTokenExpiresAt instanceof Date);
  assert.match(response.payload?.message ?? "", /correo de despedida|portada/i);
});

test("audita que un enlace de reactivacion devuelva la suscripcion al estado activo", async (t) => {
  const originalFindOne = Subscription.findOne;
  const originalMailConfigured = env.mailConfigured;
  const originalAuditCreate = AuditLog.create;
  const originalConsoleInfo = console.info;

  let saveCalls = 0;
  const previousUnsubscribeHash = "hash-previo";
  const subscription = {
    _id: createMockObjectId("subscription-reactivate"),
    name: "Lector de regreso",
    email: "regreso@example.com",
    plan: "newsletter",
    status: "cancelled",
    interests: [],
    source: "site",
    confirmationTokenHash: "hash-reactivacion",
    confirmationTokenExpiresAt: new Date("2026-08-25T00:00:00.000Z"),
    unsubscribeTokenHash: previousUnsubscribeHash,
    confirmedAt: new Date("2026-07-20T00:00:00.000Z"),
    welcomeSentAt: new Date("2026-07-20T00:00:00.000Z"),
    async save() {
      saveCalls += 1;
      return this;
    }
  };

  Subscription.findOne = async () => subscription;
  env.mailConfigured = false;
  AuditLog.create = async () => ({});
  console.info = () => {};

  t.after(() => {
    Subscription.findOne = originalFindOne;
    env.mailConfigured = originalMailConfigured;
    AuditLog.create = originalAuditCreate;
    console.info = originalConsoleInfo;
  });

  const request = createMockRequest({
    body: {
      token: "token-reactivacion-publico-1234567890"
    }
  });
  const response = createMockResponse();

  await reactivatePublicSubscription(request, response, (error) => {
    throw error;
  });

  assert.equal(response.statusCode, 200);
  assert.equal(saveCalls, 1);
  assert.equal(subscription.status, "active");
  assert.equal(subscription.confirmationTokenHash, "");
  assert.equal(subscription.confirmationTokenExpiresAt, null);
  assert.notEqual(subscription.unsubscribeTokenHash, previousUnsubscribeHash);
  assert.match(response.payload?.message ?? "", /reactivada/i);
});

test("audita que publicar una nota despache el boletin a suscriptores activos", async (t) => {
  const originalSubscriptionFind = Subscription.find;
  const originalConsoleInfo = console.info;
  const originalMailConfigured = env.mailConfigured;

  const capturedLogs = [];
  let receivedFilter = null;
  const article = {
    _id: createMockObjectId("article-newsletter"),
    slug: "nota-para-boletin",
    title: "Nota para boletin",
    subtitle: "Subtitulo editorial",
    excerpt: "Resumen breve para activar el boletin.",
    body: ["Resumen breve para activar el boletin."],
    contentBlocks: [{ type: "paragraph", text: "Resumen breve para activar el boletin." }],
    cover: { url: "", alt: "", type: "image", positionX: 50, positionY: 50 },
    author: {
      _id: createMockObjectId("admin-1"),
      name: "Administrador",
      email: "admin@periodico.local",
      role: "admin"
    },
    category: null,
    tags: ["actualidad"],
    metrics: { views: 0, shares: 0, reactions: 0 },
    status: "published",
    featured: false,
    isPremium: false,
    readingTime: 1,
    publishedAt: new Date("2026-07-26T00:00:00.000Z"),
    updatedAt: new Date("2026-07-26T00:00:00.000Z"),
    moderationNote: "",
    moderationHistory: []
  };

  Subscription.find = (filter) => ({
    async select() {
      receivedFilter = filter;
      return [
        {
          name: "Lector activo",
          email: "activo@example.com",
          status: "active",
          plan: "newsletter"
        }
      ];
    }
  });
  console.info = (...args) => {
    capturedLogs.push(args.join(" "));
  };
  env.mailConfigured = false;

  t.after(() => {
    Subscription.find = originalSubscriptionFind;
    console.info = originalConsoleInfo;
    env.mailConfigured = originalMailConfigured;
  });

  await dispatchPublishedArticleBulletin(article);

  assert.equal(receivedFilter?.status, "active");
  assert.ok(
    capturedLogs.some((entry) => entry.includes("Nueva publicaci")),
    "Publicar una nota deberia generar al menos una previsualizacion del correo editorial."
  );
});

test("audita que la busqueda publica use coincidencias parciales sin depender de indices de texto", async (t) => {
  const originalFind = Article.find;
  const originalCountDocuments = Article.countDocuments;

  let capturedFilter = null;
  let capturedSort = null;

  const foundArticle = {
    _id: createMockObjectId("article-search-1"),
    slug: "nota-sobre-premios",
    title: "El Gobierno premiará a los mejores colegios del país",
    subtitle: "Reconocimiento especial",
    excerpt: "La nueva política premiará resultados académicos destacados.",
    body: ["La estrategia premiará a las instituciones con mayores avances."],
    contentBlocks: [{ type: "paragraph", text: "La estrategia premiará a las instituciones con mayores avances." }],
    cover: { url: "", alt: "", type: "image", positionX: 50, positionY: 50 },
    author: {
      _id: createMockObjectId("admin-search"),
      name: "Administrador",
      email: "admin@periodico.local",
      role: "admin"
    },
    category: null,
    tags: ["actualidad", "educacion"],
    metrics: { views: 14, shares: 2, reactions: 3 },
    status: "published",
    featured: false,
    isPremium: false,
    readingTime: 2,
    publishedAt: new Date("2026-07-28T08:00:00.000Z"),
    updatedAt: new Date("2026-07-28T08:00:00.000Z"),
    moderationNote: "",
    moderationHistory: []
  };

  Article.find = (filter) => {
    capturedFilter = filter;

    return {
      populate() {
        return this;
      },
      sort(sort) {
        capturedSort = sort;
        return this;
      },
      skip() {
        return this;
      },
      async limit() {
        return [foundArticle];
      }
    };
  };

  Article.countDocuments = async () => 1;

  t.after(() => {
    Article.find = originalFind;
    Article.countDocuments = originalCountDocuments;
  });

  const request = createMockRequest({
    query: {
      search: "premiar"
    }
  });
  const response = createMockResponse();

  await listPublicArticles(request, response, (error) => {
    throw error;
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.payload?.items?.length, 1);
  assert.equal(capturedFilter?.status, "published");
  assert.equal(capturedFilter?.deletedAt, null);
  assert.equal("$text" in capturedFilter, false);
  assert.deepEqual(capturedSort, { publishedAt: -1, _id: -1 });
  assert.ok(Array.isArray(capturedFilter?.$and));
  assert.ok(capturedFilter.$and.length > 0);

  const firstRegex = capturedFilter.$and
    .flatMap((clause) => clause.$or ?? [])
    .map((entry) => Object.values(entry)[0])
    .find((value) => value instanceof RegExp);

  assert.ok(firstRegex instanceof RegExp);
  assert.equal(firstRegex.test("premiará"), true);
});

test("audita que el archivo publico permita excluir el articulo destacado de la paginacion", async (t) => {
  const originalFind = Article.find;
  const originalCountDocuments = Article.countDocuments;

  let capturedFilter = null;
  let capturedSort = null;
  let capturedSkip = null;
  let capturedLimit = null;

  const foundArticle = {
    _id: createMockObjectId("article-archive-2"),
    slug: "archivo-visible-sin-destacado",
    title: "Archivo visible sin repetir la portada destacada",
    subtitle: "Listado paginado",
    excerpt: "Esta nota debe aparecer en el archivo sin duplicar la portada.",
    body: ["Esta nota debe aparecer en el archivo sin duplicar la portada."],
    contentBlocks: [{ type: "paragraph", text: "Esta nota debe aparecer en el archivo sin duplicar la portada." }],
    cover: { url: "", alt: "", type: "image", positionX: 50, positionY: 50 },
    author: {
      _id: createMockObjectId("admin-archive"),
      name: "Administrador",
      email: "admin@periodico.local",
      role: "admin"
    },
    category: null,
    tags: ["archivo"],
    metrics: { views: 9, shares: 1, reactions: 0 },
    status: "published",
    featured: false,
    isPremium: false,
    readingTime: 3,
    publishedAt: new Date("2026-07-29T08:00:00.000Z"),
    updatedAt: new Date("2026-07-29T08:00:00.000Z"),
    moderationNote: "",
    moderationHistory: []
  };

  Article.find = (filter) => {
    capturedFilter = filter;

    return {
      populate() {
        return this;
      },
      sort(sort) {
        capturedSort = sort;
        return this;
      },
      skip(value) {
        capturedSkip = value;
        return this;
      },
      async limit(value) {
        capturedLimit = value;
        return [foundArticle];
      }
    };
  };

  Article.countDocuments = async () => 21;

  t.after(() => {
    Article.find = originalFind;
    Article.countDocuments = originalCountDocuments;
  });

  const request = createMockRequest({
    query: {
      page: "1",
      limit: "10",
      excludeId: "507f191e810c19729de860ea"
    }
  });
  const response = createMockResponse();

  await listPublicArticles(request, response, (error) => {
    throw error;
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.payload?.items?.length, 1);
  assert.equal(capturedFilter?.status, "published");
  assert.equal(capturedFilter?.deletedAt, null);
  assert.deepEqual(capturedFilter?._id, { $ne: "507f191e810c19729de860ea" });
  assert.deepEqual(capturedSort, { publishedAt: -1, _id: -1 });
  assert.equal(capturedSkip, 0);
  assert.equal(capturedLimit, 10);
  assert.equal(response.payload?.pagination?.total, 21);
  assert.equal(response.payload?.pagination?.totalPages, 3);
});

test("audita que destacar un articulo retire el destacado previo para mantener una unica portada activa", async (t) => {
  const originalFindOne = Article.findOne;
  const originalUpdateMany = Article.updateMany;
  const originalUpdateOne = Article.updateOne;
  const originalSiteSettingUpdate = SiteSetting.findOneAndUpdate;
  const originalAuditCreate = AuditLog.create;

  const updateManyCalls = [];
  const updateOneCalls = [];
  const featuredArticle = {
    _id: createMockObjectId("article-1"),
    title: "Portada auditada",
    subtitle: "",
    excerpt: "Texto de prueba para auditoria.",
    body: ["Texto de prueba para auditoria."],
    contentBlocks: [{ type: "paragraph", text: "Texto de prueba para auditoria." }],
    cover: { url: "", alt: "", type: "image", positionX: 50, positionY: 50 },
    author: {
      _id: createMockObjectId("admin-1"),
      name: "Administrador",
      email: "admin@periodico.local",
      role: "admin"
    },
    category: null,
    tags: [],
    metrics: { views: 0, shares: 0, reactions: 0 },
    status: "published",
    featured: false,
    isPremium: false,
    readingTime: 1,
    publishedAt: new Date("2026-07-24T00:00:00.000Z"),
    updatedAt: new Date("2026-07-24T00:00:00.000Z"),
    moderationNote: "",
    moderationHistory: [],
    async save() {
      return this;
    }
  };

  Article.findOne = () => ({
    async populate() {
      return featuredArticle;
    }
  });
  Article.updateMany = async (...args) => {
    updateManyCalls.push(args);
    return { acknowledged: true, modifiedCount: 1 };
  };
  Article.updateOne = async (...args) => {
    updateOneCalls.push(args);
    return { acknowledged: true, modifiedCount: 1 };
  };
  SiteSetting.findOneAndUpdate = async () => ({
    key: "main",
    featuredArticle: featuredArticle._id
  });
  AuditLog.create = async () => ({});

  t.after(() => {
    Article.findOne = originalFindOne;
    Article.updateMany = originalUpdateMany;
    Article.updateOne = originalUpdateOne;
    SiteSetting.findOneAndUpdate = originalSiteSettingUpdate;
    AuditLog.create = originalAuditCreate;
  });

  const request = createMockRequest({
    params: { articleId: "article-1" },
    body: { action: "feature", note: "" }
  });
  const response = createMockResponse();

  await moderateArticle(request, response, (error) => {
    throw error;
  });

  assert.equal(response.statusCode, 200);
  assert.equal(
    updateManyCalls.length,
    1,
    "Destacar una pieza deberia desmarcar cualquier otro articulo destacado para evitar multiples portadas activas."
  );
  assert.equal(updateOneCalls.length, 1, "La portada activa debe marcarse de forma explicita en el articulo seleccionado.");
});

test("audita que no se pueda borrar un periodista con articulos asociados sin reasignacion previa", async (t) => {
  const originalFindById = User.findById;
  const originalDeleteOne = User.deleteOne;
  const originalCountDocuments = Article.countDocuments;
  const originalAuditCreate = AuditLog.create;

  let deleteCalled = false;
  User.findById = async () => ({
    _id: createMockObjectId("journalist-1"),
    email: "periodista@example.com",
    role: "journalist",
    status: "active"
  });
  User.deleteOne = async () => {
    deleteCalled = true;
    return { acknowledged: true, deletedCount: 1 };
  };
  Article.countDocuments = async () => 3;
  AuditLog.create = async () => ({});

  t.after(() => {
    User.findById = originalFindById;
    User.deleteOne = originalDeleteOne;
    Article.countDocuments = originalCountDocuments;
    AuditLog.create = originalAuditCreate;
  });

  const request = createMockRequest({
    params: { userId: "journalist-1" }
  });
  const response = createMockResponse();

  await deleteUser(request, response, (error) => {
    throw error;
  });

  assert.equal(
    response.statusCode,
    409,
    "Antes de borrar un periodista con piezas publicadas deberia exigirse reasignacion o bloqueo, no eliminacion directa."
  );
  assert.equal(deleteCalled, false, "No deberia borrarse el usuario mientras existan articulos asociados.");
});

test("audita que un periodista con notas solo en papelera pueda eliminarse", async (t) => {
  const originalFindById = User.findById;
  const originalDeleteOne = User.deleteOne;
  const originalCountDocuments = Article.countDocuments;
  const originalAuditCreate = AuditLog.create;

  let deleteCalled = false;
  let receivedFilter = null;
  User.findById = async () => ({
    _id: createMockObjectId("journalist-trash-only"),
    email: "papelera@example.com",
    role: "journalist",
    status: "blocked"
  });
  User.deleteOne = async () => {
    deleteCalled = true;
    return { acknowledged: true, deletedCount: 1 };
  };
  Article.countDocuments = async (filter) => {
    receivedFilter = filter;
    return 0;
  };
  AuditLog.create = async () => ({});

  t.after(() => {
    User.findById = originalFindById;
    User.deleteOne = originalDeleteOne;
    Article.countDocuments = originalCountDocuments;
    AuditLog.create = originalAuditCreate;
  });

  const request = createMockRequest({
    params: { userId: "journalist-trash-only" }
  });
  const response = createMockResponse();

  await deleteUser(request, response, (error) => {
    throw error;
  });

  assert.equal(response.statusCode, 200);
  assert.equal(deleteCalled, true);
  assert.equal(receivedFilter?.deletedAt, null);
  assert.equal(receivedFilter?.author?.toString?.(), "journalist-trash-only");
});

test("audita que un periodista no pueda devolver a revision una nota ya publicada", async (t) => {
  const originalFindOne = Article.findOne;

  const publishedArticle = {
    _id: createMockObjectId("article-published"),
    status: "published",
    author: {
      _id: createMockObjectId("journalist-1")
    }
  };

  Article.findOne = () => ({
    async populate() {
      return publishedArticle;
    }
  });

  t.after(() => {
    Article.findOne = originalFindOne;
  });

  const request = createMockRequest({
    params: { articleId: "article-published" },
    user: {
      _id: "journalist-1",
      email: "periodista@example.com",
      role: "journalist"
    }
  });
  const response = createMockResponse();

  await submitArticleForReview(request, response, (error) => {
    throw error;
  });

  assert.equal(response.statusCode, 409);
  assert.equal(publishedArticle.status, "published");
});

test("audita que borrar una nota la envie a papelera editorial y no haga borrado duro", async (t) => {
  const originalFindById = Article.findById;
  const originalDeleteOne = Article.deleteOne;
  const originalUpdateOne = Article.updateOne;
  const originalSiteSettingUpdate = SiteSetting.findOneAndUpdate;
  const originalAuditCreate = AuditLog.create;

  let hardDeleteCalled = false;
  const article = {
    _id: createMockObjectId("article-trash"),
    title: "Nota a papelera",
    status: "draft",
    featured: false,
    deletedAt: null,
    deletedBy: null,
    deletionReason: "",
    moderationHistory: [],
    author: {
      _id: createMockObjectId("journalist-1")
    },
    async save() {
      return this;
    }
  };

  Article.findById = () => ({
    async populate() {
      return article;
    }
  });
  Article.deleteOne = async () => {
    hardDeleteCalled = true;
    return { acknowledged: true, deletedCount: 1 };
  };
  Article.updateOne = async () => ({ acknowledged: true, modifiedCount: 1 });
  SiteSetting.findOneAndUpdate = async () => ({ key: "main", featuredArticle: null });
  AuditLog.create = async () => ({});

  t.after(() => {
    Article.findById = originalFindById;
    Article.deleteOne = originalDeleteOne;
    Article.updateOne = originalUpdateOne;
    SiteSetting.findOneAndUpdate = originalSiteSettingUpdate;
    AuditLog.create = originalAuditCreate;
  });

  const request = createMockRequest({
    params: { articleId: "article-trash" },
    user: {
      _id: "journalist-1",
      email: "periodista@example.com",
      role: "journalist"
    }
  });
  const response = createMockResponse();

  await deleteDashboardArticle(request, response, (error) => {
    throw error;
  });

  assert.equal(response.statusCode, 200);
  assert.equal(hardDeleteCalled, false);
  assert.ok(article.deletedAt instanceof Date);
  assert.equal(response.payload?.message, "Artículo enviado a papelera editorial.");
});

test("audita que limpiar el destacado no intente crear otro registro main cuando la portada apunta a otra nota", async (t) => {
  const originalUpdateOne = Article.updateOne;
  const originalSiteSettingUpdate = SiteSetting.findOneAndUpdate;

  const currentArticleId = createMockObjectId("article-current");
  let saveCalled = false;

  Article.updateOne = async () => ({ acknowledged: true, modifiedCount: 1 });
  SiteSetting.findOneAndUpdate = async () => ({
    key: "main",
    featuredArticle: createMockObjectId("article-featured-other"),
    async save() {
      saveCalled = true;
      return this;
    }
  });

  t.after(() => {
    Article.updateOne = originalUpdateOne;
    SiteSetting.findOneAndUpdate = originalSiteSettingUpdate;
  });

  await clearFeaturedArticleSelection(currentArticleId);

  assert.equal(saveCalled, false);
});

test("audita que las vistas publicas no sumen varias veces dentro de la misma ventana del lector", async (t) => {
  const originalFindOne = Article.findOne;
  const originalUpdateOne = Article.updateOne;
  const originalArticleViewCreate = ArticleView.create;

  let updateCalls = 0;
  const article = {
    _id: createMockObjectId("article-views"),
    slug: "nota-vistas",
    title: "Nota con vistas",
    subtitle: "",
    excerpt: "Texto breve.",
    body: ["Texto breve."],
    contentBlocks: [{ type: "paragraph", text: "Texto breve." }],
    cover: { url: "", alt: "", type: "image", positionX: 50, positionY: 50 },
    author: {
      _id: createMockObjectId("admin-1"),
      name: "Administrador",
      role: "admin"
    },
    category: null,
    tags: [],
    metrics: { views: 3, shares: 0, reactions: 0 },
    isPremium: false,
    featured: false,
    readingTime: 1,
    publishedAt: new Date("2026-07-24T00:00:00.000Z"),
    updatedAt: new Date("2026-07-24T00:00:00.000Z")
  };

  Article.findOne = (query) => ({
    populate() {
      if (query.slug === "nota-vistas") {
        return Promise.resolve(article);
      }

      return {
        sort: async () => null
      };
    }
  });
  Article.updateOne = async () => {
    updateCalls += 1;
    return { acknowledged: true, modifiedCount: 1 };
  };
  ArticleView.create = async () => ({ acknowledged: true });

  t.after(() => {
    Article.findOne = originalFindOne;
    Article.updateOne = originalUpdateOne;
    ArticleView.create = originalArticleViewCreate;
  });

  const measurementConsentCookie = encodeURIComponent(
    JSON.stringify({
      essential: true,
      preferences: false,
      measurement: true,
      version: 1,
      updatedAt: "2026-07-26T00:00:00.000Z"
    })
  );

  const firstRequest = createMockRequest({
    params: { slug: "nota-vistas" },
    cookies: {
      cp_cookie_preferences: measurementConsentCookie
    }
  });
  const firstResponse = createMockResponse();

  await getPublicArticle(firstRequest, firstResponse, (error) => {
    throw error;
  });

  assert.equal(updateCalls, 1);
  assert.equal(firstResponse.cookies.length, 1);

  const secondRequest = createMockRequest({
    params: { slug: "nota-vistas" },
    cookies: {
      cp_cookie_preferences: measurementConsentCookie,
      [firstResponse.cookies[0].name]: firstResponse.cookies[0].value
    }
  });
  const secondResponse = createMockResponse();

  await getPublicArticle(secondRequest, secondResponse, (error) => {
    throw error;
  });

  assert.equal(updateCalls, 1, "La segunda lectura en la misma ventana no deberia sumar otra vista.");
});

test("audita que las vistas publicas no puedan inflarse repitiendo la carga sin cookie desde el mismo visitante tecnico", async (t) => {
  const originalFindOne = Article.findOne;
  const originalUpdateOne = Article.updateOne;
  const originalArticleViewCreate = ArticleView.create;

  let updateCalls = 0;
  let createCalls = 0;
  const duplicateError = Object.assign(new Error("duplicated"), { code: 11000 });
  const article = {
    _id: createMockObjectId("article-views-fingerprint"),
    slug: "nota-vistas-fingerprint",
    title: "Nota protegida",
    subtitle: "",
    excerpt: "Texto breve.",
    body: ["Texto breve."],
    contentBlocks: [{ type: "paragraph", text: "Texto breve." }],
    cover: { url: "", alt: "", type: "image", positionX: 50, positionY: 50 },
    author: {
      _id: createMockObjectId("admin-1"),
      name: "Administrador",
      role: "admin"
    },
    category: null,
    tags: [],
    metrics: { views: 7, shares: 0, reactions: 0 },
    isPremium: false,
    featured: false,
    readingTime: 1,
    publishedAt: new Date("2026-07-24T00:00:00.000Z"),
    updatedAt: new Date("2026-07-24T00:00:00.000Z")
  };

  Article.findOne = (query) => ({
    populate() {
      if (query.slug === "nota-vistas-fingerprint") {
        return Promise.resolve(article);
      }

      return {
        sort: async () => null
      };
    }
  });
  Article.updateOne = async () => {
    updateCalls += 1;
    return { acknowledged: true, modifiedCount: 1 };
  };
  ArticleView.create = async () => {
    createCalls += 1;

    if (createCalls > 1) {
      throw duplicateError;
    }

    return { acknowledged: true };
  };

  t.after(() => {
    Article.findOne = originalFindOne;
    Article.updateOne = originalUpdateOne;
    ArticleView.create = originalArticleViewCreate;
  });

  const headers = {
    "user-agent": "QA Browser",
    "accept-language": "es-CO",
    "sec-ch-ua": "\"Chromium\";v=\"126\"",
    "sec-ch-ua-platform": "\"Windows\"",
    "sec-ch-ua-mobile": "?0"
  };
  const measurementConsentCookie = encodeURIComponent(
    JSON.stringify({
      essential: true,
      preferences: false,
      measurement: true,
      version: 1,
      updatedAt: "2026-07-26T00:00:00.000Z"
    })
  );

  const firstRequest = createMockRequest({
    params: { slug: "nota-vistas-fingerprint" },
    cookies: {
      cp_cookie_preferences: measurementConsentCookie
    },
    headers,
    ip: "10.0.0.7"
  });
  const firstResponse = createMockResponse();

  await getPublicArticle(firstRequest, firstResponse, (error) => {
    throw error;
  });

  const secondRequest = createMockRequest({
    params: { slug: "nota-vistas-fingerprint" },
    cookies: {
      cp_cookie_preferences: measurementConsentCookie
    },
    headers,
    ip: "10.0.0.7"
  });
  const secondResponse = createMockResponse();

  await getPublicArticle(secondRequest, secondResponse, (error) => {
    throw error;
  });

  assert.equal(createCalls, 2);
  assert.equal(updateCalls, 1, "Una segunda carga sin cookie desde el mismo origen tecnico no deberia sumar otra vista.");
});
