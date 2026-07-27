function humanizeField(path) {
  const labels = {
    name: "nombre",
    email: "correo",
    password: "contrasena",
    title: "titulo",
    subtitle: "subtitulo",
    excerpt: "extracto",
    body: "cuerpo",
    contentBlocks: "contenido",
    heading: "encabezado",
    text: "texto",
    align: "alineacion",
    level: "nivel",
    cover: "portada",
    url: "URL",
    alt: "texto alternativo",
    caption: "leyenda",
    categoryId: "categoria",
    tags: "etiquetas",
    note: "nota",
    token: "token",
    currentPassword: "contrasena actual",
    nextPassword: "nueva contrasena",
    confirmPassword: "confirmacion de contrasena",
    filename: "nombre del archivo",
    dataUrl: "archivo"
  };

  return path
    .map((segment) => labels[String(segment)] ?? String(segment))
    .join(" > ") || "campo";
}

function formatZodIssue(issue) {
  if (typeof issue.message === "string" && /[A-Za-z]/.test(issue.message) && !/^Too small|^Too big|^Invalid|^Unrecognized|^expected/i.test(issue.message)) {
    return issue.message;
  }

  const field = humanizeField(issue.path ?? []);

  switch (issue.code) {
    case "too_small":
      if (issue.origin === "string") {
        return `El campo ${field} debe tener al menos ${issue.minimum} caracteres.`;
      }

      if (issue.origin === "array") {
        return `El campo ${field} debe incluir al menos ${issue.minimum} elementos.`;
      }

      return `El campo ${field} es demasiado corto.`;
    case "too_big":
      if (issue.origin === "string") {
        return `El campo ${field} no puede superar ${issue.maximum} caracteres.`;
      }

      if (issue.origin === "array") {
        return `El campo ${field} no puede superar ${issue.maximum} elementos.`;
      }

      return `El campo ${field} es demasiado largo.`;
    case "invalid_type":
      return `El campo ${field} tiene un tipo de dato invalido.`;
    case "invalid_format":
      if (issue.format === "email") {
        return `El campo ${field} debe ser un correo valido.`;
      }

      if (issue.format === "url") {
        return `El campo ${field} debe ser una URL valida.`;
      }

      return `El campo ${field} tiene un formato invalido.`;
    case "invalid_value":
      return `El campo ${field} contiene un valor no permitido.`;
    case "custom":
      return issue.message || `El campo ${field} no es valido.`;
    default:
      return `El campo ${field} no es valido.`;
  }
}

export function errorHandler(error, _req, res, _next) {
  console.error(error);

  if (error.name === "ZodError") {
    return res.status(400).json({
      message: "Datos invalidos.",
      details: error.issues.map((issue) => formatZodIssue(issue))
    });
  }

  if (error.name === "ValidationError") {
    return res.status(400).json({
      message: "Datos invalidos.",
      details: Object.values(error.errors).map((entry) => entry.message)
    });
  }

  if (error.code === 11000) {
    return res.status(409).json({
      message: "El recurso ya existe."
    });
  }

  if (error.name === "JsonWebTokenError") {
    return res.status(401).json({
      message: "Sesion invalida."
    });
  }

  if (typeof error.status === "number") {
    return res.status(error.status).json({
      message: error.message || "Solicitud invalida."
    });
  }

  res.status(500).json({
    message: "Ocurrio un error interno en el servidor."
  });
}
