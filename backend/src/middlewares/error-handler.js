function humanizeField(path) {
  const labels = {
    name: "nombre",
    email: "correo",
    password: "contraseña",
    title: "título",
    subtitle: "subtítulo",
    excerpt: "extracto",
    body: "cuerpo",
    contentBlocks: "contenido",
    heading: "encabezado",
    text: "texto",
    align: "alineación",
    level: "nivel",
    cover: "portada",
    url: "URL",
    alt: "texto alternativo",
    caption: "leyenda",
    categoryId: "categoría",
    tags: "etiquetas",
    note: "nota",
    token: "token",
    currentPassword: "contraseña actual",
    nextPassword: "nueva contraseña",
    confirmPassword: "confirmación de contraseña",
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
      return `El campo ${field} tiene un tipo de dato inválido.`;
    case "invalid_format":
      if (issue.format === "email") {
        return `El campo ${field} debe ser un correo válido.`;
      }

      if (issue.format === "url") {
        return `El campo ${field} debe ser una URL válida.`;
      }

      return `El campo ${field} tiene un formato inválido.`;
    case "invalid_value":
      return `El campo ${field} contiene un valor no permitido.`;
    case "custom":
      return issue.message || `El campo ${field} no es válido.`;
    default:
      return `El campo ${field} no es válido.`;
  }
}

export function errorHandler(error, _req, res, _next) {
  console.error(error);

  if (error.name === "ZodError") {
    return res.status(400).json({
      message: "Datos inválidos.",
      details: error.issues.map((issue) => formatZodIssue(issue))
    });
  }

  if (error.name === "ValidationError") {
    return res.status(400).json({
      message: "Datos inválidos.",
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
      message: "Sesión inválida."
    });
  }

  if (typeof error.status === "number") {
    return res.status(error.status).json({
      message: error.message || "Solicitud inválida."
    });
  }

  res.status(500).json({
    message: "Ocurrió un error interno en el servidor."
  });
}
