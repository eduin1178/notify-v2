# Preguntas de levantamiento de requisitos — Notify

**Fecha:** 2026-05-06  
**Analista:** Ingeniero de software (especificación y desarrollo)  
**Fuente:** `00-intake.md` — cliente Eduin Peñata Romero / EduNet

---

> **Leyenda de prioridad**
> - 🔴 **CRÍTICA** — sin respuesta no puedo arrancar
> - 🟡 **IMPORTANTE** — puedo asumir pero debería confirmar
> - 🟢 **DESEABLE** — puedo asumir un default razonable

---

## 1. Objetivos de negocio

| # | Pregunta | Prioridad |
|---|----------|-----------|
| 1.1 | ¿La plataforma será de uso interno de EduNet o la van a revender/licenciar a sus propios clientes (modelo SaaS multiusuario)? | 🔴 |
| 1.2 | Si la van a revender: ¿cada cliente final tendrá su propia cuenta aislada, o compartirán una instalación única administrada por ustedes? | 🔴 |
| 1.3 | ¿Cuál es el problema principal que tiene hoy sin esta plataforma? ¿Están usando alguna herramienta temporal (Excel, WhatsApp manual, otra app)? | 🟡 |
| 1.4 | ¿Tienen pensado monetizar la plataforma por volumen de mensajes, por número de contactos, por suscripción fija mensual, o alguna combinación? | 🟡 |
| 1.5 | ¿Hay algún competidor específico cuya experiencia de usuario les gusta y quieran tomar como referencia de cómo debería sentirse la plataforma? | 🟢 |

---

## 2. Usuarios y roles

| # | Pregunta | Prioridad |
|---|----------|-----------|
| 2.1 | ¿Quiénes van a usar la plataforma dentro de EduNet? ¿Solo administradores técnicos o también personal de ventas/marketing sin perfil técnico? | 🔴 |
| 2.2 | Si es multicliente (SaaS): ¿cada empresa cliente necesita su propio administrador que pueda gestionar usuarios de su equipo? | 🔴 |
| 2.3 | ¿Necesitan que diferentes usuarios dentro de una misma empresa tengan permisos distintos? Por ejemplo: uno puede crear campañas pero no puede eliminar contactos. | 🟡 |
| 2.4 | ¿Cómo se registran los usuarios? ¿Invitación por correo, registro libre, o solo el super-administrador crea las cuentas? | 🟡 |
| 2.5 | ¿Necesitan inicio de sesión con Google, Microsoft u otro proveedor, o con usuario y contraseña propio es suficiente? | 🟢 |

---

## 3. Datos críticos

| # | Pregunta | Prioridad |
|---|----------|-----------|
| 3.1 | ¿Qué datos mínimos necesitan guardar de un contacto? (nombre, teléfono, correo, empresa, cargo, etc.) | 🔴 |
| 3.2 | ¿Desde dónde van a llegar los contactos? ¿Solo importación manual (Excel/CSV), solo desde formularios web, o ambas? | 🔴 |
| 3.3 | ¿Necesitan guardar el historial de mensajes enviados a cada contacto? ¿Por cuánto tiempo? | 🟡 |
| 3.4 | ¿Los contactos pueden estar repetidos (mismo número en varias campañas)? ¿Cómo quieren manejar duplicados? | 🟡 |
| 3.5 | ¿Los datos de contactos son propiedad del cliente final (en modelo SaaS) y deben estar completamente aislados entre empresas? | 🔴 |
| 3.6 | ¿Necesitan campos personalizados por contacto? Por ejemplo, "nivel de curso comprado", "ciudad", "agente asignado". | 🟢 |

---

## 4. Flujos principales

| # | Pregunta | Prioridad |
|---|----------|-----------|
| 4.1 | **Campaña masiva:** ¿El usuario selecciona los contactos, redacta el mensaje y lo envía en ese momento, o solo programa el envío para después? ¿Puede hacer ambas cosas? | 🔴 |
| 4.2 | **Mensajes programados:** ¿La cola de mensajes programados opera contacto por contacto (mensaje individual en fecha X) o es una campaña completa que se dispara en una fecha? | 🔴 |
| 4.3 | **Webhook/automatización:** Cuando llega un evento desde fuera (formulario, anuncio Meta), ¿qué condiciones necesitan evaluar? Ejemplos: ¿"si el contacto ya está en la base NO enviar"?, ¿"si el país es Colombia enviar mensaje A, si es México enviar B"? | 🔴 |
| 4.4 | **Automatización:** ¿Necesitan encadenar acciones en el tiempo? Por ejemplo: "enviar mensaje de bienvenida al registrarse → esperar 24 horas → enviar recordatorio". | 🟡 |
| 4.5 | **Plantillas:** ¿Los mensajes deben usar plantillas aprobadas por Meta (HSM) o también quieren enviar mensajes de sesión (respuestas a conversaciones activas)? | 🔴 |
| 4.6 | **Respuestas:** ¿La plataforma debe gestionar las respuestas que llegan de los clientes (bandeja de entrada), o solo necesitan el envío? | 🟡 |
| 4.7 | **CRM:** ¿Qué acciones de seguimiento necesitan registrar manualmente sobre un contacto? ¿Notas, cambio de etiqueta, asignación a un agente? | 🟢 |

---

## 5. Restricciones no funcionales

| # | Pregunta | Prioridad |
|---|----------|-----------|
| 5.1 | ¿Cuántos mensajes estiman enviar al mes en total (todos los clientes combinados)? Rangos orientativos: menos de 10 000, entre 10 000 y 100 000, más de 100 000. | 🔴 |
| 5.2 | ¿Cuántos contactos totales esperan manejar en la base de datos al inicio y en un año? | 🟡 |
| 5.3 | ¿La plataforma debe funcionar bien en celular (diseño responsivo) o se usará principalmente desde computadora? | 🟡 |
| 5.4 | ¿Necesitan una app móvil (iOS/Android) o con que funcione en el navegador del celular es suficiente? | 🟡 |
| 5.5 | ¿Cuántos usuarios simultáneos esperan tener usando la plataforma al mismo tiempo en un momento de pico? | 🟢 |

---

## 6. Seguridad y cumplimiento

| # | Pregunta | Prioridad |
|---|----------|-----------|
| 6.1 | ¿Los contactos que van a recibir mensajes han dado su consentimiento explícito para ser contactados por WhatsApp? ¿Tienen registro de ese consentimiento? | 🔴 |
| 6.2 | ¿Sus clientes finales son de Colombia, de otros países latinoamericanos, o también de España/Europa? (Esto afecta si aplica GDPR o la Ley 1581 de Colombia.) | 🔴 |
| 6.3 | ¿Deben cumplir con la Ley 1581 de Colombia (Habeas Data) para el manejo de datos personales? ¿Ya cuentan con política de privacidad? | 🟡 |
| 6.4 | ¿Necesitan un mecanismo de "opt-out" (botón de baja) automático para que un contacto pueda pedir que no le envíen más mensajes? | 🟡 |
| 6.5 | ¿Los datos de los clientes deben almacenarse en Colombia o puede ser en servidores en otro país (AWS, Google Cloud, etc.)? | 🟢 |

---

## 7. Integraciones

| # | Pregunta | Prioridad |
|---|----------|-----------|
| 7.1 | ¿Qué proveedor de API de WhatsApp van a usar? ¿Ya tienen acceso a la API oficial de Meta (WhatsApp Business API / Cloud API), o van a usar un intermediario como Twilio, 360dialog, MessageBird? | 🔴 |
| 7.2 | ¿Desde qué plataformas específicas llegarán los webhooks? (WordPress, Wix, Hotmart, Manychat, Google Ads, Meta Lead Ads, etc.) | 🟡 |
| 7.3 | ¿Necesitan conectarse a algún CRM o herramienta que ya usen hoy? (HubSpot, Zoho, ActiveCampaign, Mailchimp, etc.) | 🟡 |
| 7.4 | ¿Necesitan integración con pasarelas de pago para detectar compras y disparar mensajes? (ePayco, Wompi, PayU, Stripe) | 🟢 |
| 7.5 | ¿Necesitan alguna integración con plataformas de cursos online? (Hotmart, Teachable, LearnDash, Moodle) | 🟢 |

---

## 8. Despliegue y mantenimiento

| # | Pregunta | Prioridad |
|---|----------|-----------|
| 8.1 | ¿Quién va a administrar técnicamente la plataforma después de entregada? ¿EduNet tiene alguien técnico que pueda hacer actualizaciones y monitoreo? | 🔴 |
| 8.2 | ¿Prefieren que la plataforma corra en la nube (AWS, Google Cloud, Railway, Vercel) o necesitan instalarla en un servidor propio? | 🔴 |
| 8.3 | ¿Necesitan soporte para múltiples números de WhatsApp (una por cada cliente final, por ejemplo)? | 🔴 |
| 8.4 | ¿Quieren un dominio propio para la plataforma (ej: app.edunet.com) o pueden usar un subdominio del proveedor de hosting? | 🟢 |
| 8.5 | ¿Tienen preferencia de proveedor de nube o de tecnología para el backend/frontend? (PHP, Node.js, Python, etc.) | 🟢 |

---

## 9. Criterios de éxito

| # | Pregunta | Prioridad |
|---|----------|-----------|
| 9.1 | ¿Cómo van a medir que la plataforma está funcionando bien? ¿Por número de mensajes enviados exitosamente, por tasa de apertura, por clientes captados, por otra métrica? | 🟡 |
| 9.2 | ¿Necesitan reportes o estadísticas dentro de la plataforma? ¿Cuáles? (mensajes enviados/fallidos, apertura, clics, campañas activas) | 🟡 |
| 9.3 | ¿Cuál sería el escenario mínimo con el que estarían satisfechos para un lanzamiento inicial (MVP)? ¿Qué funcionalidades son imprescindibles desde el día 1? | 🔴 |
| 9.4 | ¿Qué considerarían un fracaso del proyecto? ¿Hay algo específico que definitivamente NO debe pasar? | 🟢 |

---

## 10. Restricciones de proyecto

| # | Pregunta | Prioridad |
|---|----------|-----------|
| 10.1 | ¿Tienen un presupuesto definido o aproximado para el desarrollo de esta plataforma? | 🔴 |
| 10.2 | ¿Tienen alguna fecha objetivo para tener un primer prototipo o versión funcional? | 🔴 |
| 10.3 | ¿El desarrollo lo haré yo solo o habrá más personas del equipo (diseñadores, QA, otros desarrolladores) involucradas? | 🟡 |
| 10.4 | ¿Tienen ya alguna identidad visual definida (colores, logo, tipografía) que deba aplicarse a la plataforma? | 🟡 |
| 10.5 | ¿Hay alguna tecnología o stack técnico que ya tengan contratado o que sea obligatorio usar (hosting, base de datos, lenguaje)? | 🟢 |

---

## Supuestos seguros (no preguntar al cliente)

Estas son cosas que el dominio del negocio hace evidentes. Asumirlas ahorra tiempo de reunión.

| # | Supuesto | Justificación |
|---|----------|---------------|
| S1 | **Los mensajes se enviarán exclusivamente vía WhatsApp Business API de Meta**, no por WhatsApp Web scraping ni soluciones no oficiales. | Cualquier solución basada en scraping o bots no-oficiales viola los Términos de Servicio de Meta y puede resultar en el bloqueo permanente del número. Un cliente que busca escala no puede asumir ese riesgo. |
| S2 | **La plataforma será una aplicación web**, no una app nativa iOS/Android como producto principal. | El cliente es una pequeña empresa (5-10 personas) de consultoría digital. El costo de desarrollo y distribución de apps nativas multiplica el presupuesto. Una PWA responsiva cubre el 95% de sus necesidades operativas. |
| S3 | **Los mensajes masivos deben respetar los límites de velocidad de envío de la API de Meta** (rate limits por número de teléfono). | Esto no es una decisión de diseño, es una restricción de infraestructura impuesta por Meta. Excederlos resulta en bloqueos temporales o permanentes del número. |
| S4 | **Las plantillas de mensajes masivos (fuera de ventana de 24h) deben estar pre-aprobadas por Meta (HSM)**. | Es el comportamiento estándar de la WhatsApp Business API. No preguntar al cliente porque es un requisito no negociable de la plataforma subyacente. |
| S5 | **El sistema necesita persistencia de datos en base de datos relacional o documental**, no archivos planos ni hojas de cálculo. | El volumen de contactos, campañas y mensajes que describe el cliente (bases de datos importables, historial de envíos, segmentación) requiere un motor de base de datos real desde el día 1. |
| S6 | **El panel de administración necesitará autenticación con usuario y contraseña como mínimo**. | Es el piso mínimo de seguridad para cualquier aplicación con datos de clientes. No tiene sentido preguntar si quieren autenticación — la pregunta correcta es QUÉ tipo (ver 2.5). |
| S7 | **Los envíos programados se gestionarán con una cola de trabajos en background**, no con consultas sincrónicas. | Un sistema que envía mensajes masivos en fechas futuras no puede depender de que alguien esté conectado en ese momento. Esto es arquitectura, no una preferencia del cliente. |
| S8 | **El cliente no tiene restricciones de GDPR europeo** si opera solo en Colombia y Latinoamérica. | Aplica la Ley 1581 de Colombia (Habeas Data), no GDPR. Solo cambia si tienen usuarios en España/Europa (ver pregunta 6.2). |
