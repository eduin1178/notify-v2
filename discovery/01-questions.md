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

Respuestas:
1.1. ✅ Se revendera como SaaS multiinquilino, cada cliente con su propia cuenta aislada.
1.2. ✅ Cada cliente final tendrá su propia cuenta aislada.
1.3. ✅ El problema principal la complejidad técnica de gestionar automatizaciones de manera administrada para los clientes de EduNet, que actualmente se hace de forma manual o con herramientas no especializadas como n8n y almacenando datos en google sheets.
1.4. ✅ Monetización por suscripción fija mensual, con planes escalonados con paquetes de mensajes incluidos y cobro adicional por mensajes extra.
1.5. ✅ No hay un competidor específico, pero se busca una experiencia de usuario simple, intuitiva y moderna, pero adaptada a las particularidades de WhatsApp.
---

## 2. Usuarios y roles

| # | Pregunta | Prioridad |
|---|----------|-----------|
| 2.1 | ¿Quiénes van a usar la plataforma dentro de EduNet? ¿Solo administradores técnicos o también personal de ventas/marketing sin perfil técnico? | 🔴 |
| 2.2 | Si es multicliente (SaaS): ¿cada empresa cliente necesita su propio administrador que pueda gestionar usuarios de su equipo? | 🔴 |
| 2.3 | ¿Necesitan que diferentes usuarios dentro de una misma empresa tengan permisos distintos? Por ejemplo: uno puede crear campañas pero no puede eliminar contactos. | 🟡 |
| 2.4 | ¿Cómo se registran los usuarios? ¿Invitación por correo, registro libre, o solo el super-administrador crea las cuentas? | 🟡 |
| 2.5 | ¿Necesitan inicio de sesión con Google, Microsoft u otro proveedor, o con usuario y contraseña propio es suficiente? | 🟢 |

Respuestas:
2.1. ✅ Dentro de EduNet, los usuarios serán principalmente administradores técnicos y personal de ventas/marketing con perfil no técnico.
2.2. ✅ Sí, cada empresa cliente tendrá su propio administrador que podrá gestionar usuarios de su equipo.
2.3. ✅ Sí, se planea que sean **4 roles** en total. El multi-tenant es exclusivamente por **Organización** (un usuario puede pertenecer a una o varias organizaciones, con un rol distinto en cada una). No existe un nivel `Workspace` por debajo:
  1. **SuperAdmin** — staff de EduNet y sus agentes. Rol global a toda la plataforma (no de organización). Acceso cross-tenant para soporte, monitoreo de consumo, suspensión de organizaciones y métricas de negocio.
  2. **Owner** — quien crea la organización. Todos los permisos dentro de su organización, incluyendo billing, transferir propiedad y eliminarla. Único por organización (transferible).
  3. **Admin** — miembro con permisos para gestionar usuarios y roles dentro de la organización (excepto el rol `Owner`). Configura canales, plantillas, automations, campañas. No toca billing crítico ni elimina la organización.
  4. **Miembro (Member)** — usuario con permisos específicos sobre funcionalidades, **concedidos o denegados explícitamente** por un `Admin` u `Owner`. Sin permisos por defecto.
2.4. ✅ El registro de usuarios se hará principalmente por invitación por correo electrónico. Aunque tambien cada usuario podrá registrarse directamente y se creará un tenant para su organizacion y este tenant se activará en plan free con algunos mensajes incluidos para pruebas. Luego deberá elegir un plan de pago para seguir usando la plataforma.
2.5. ✅ Se prefiere inicio de sesión con Google para facilitar el acceso pero debe tambien incluir acceso con magic link.

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

Respuestas:
3.1. ✅ Los datos mínimos que se necesitan guardar de un contacto son: nombre, teléfono, correo electrónico, empresa, cargo, país y etiquetas personalizadas.
3.2. ✅ Los contactos llegarán tanto por importación manual (Excel/CSV) como desde formularios web (webhooks).
3.3. ✅ Sí, necesitan guardar el historial de mensajes enviados a cada contacto por al menos 6 meses para poder hacer seguimiento y análisis de campañas y para fines de facturación.
3.4. ✅ Los contactos no deberían estar repetidos, el sistema debe manejar duplicados evitando que el mismo número de teléfono se agregue más de una vez. Si se intenta agregar un contacto con un número ya existente, el sistema debería informar al usuario y permitirle actualizar los datos.
3.5. ✅ Sí, los datos de contactos son propiedad del cliente final y deben estar completamente aislados entre empresas en el modelo SaaS.
3.6. ✅ Sí, necesitan campos personalizados por contacto para poder segmentar y personalizar los mensajes según características específicas como "nivel de curso comprado", "ciudad" o "agente asignado".
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

Respuestas:
4.1 ✅ El usuario puede tanto redactar un mensaje y enviarlo en ese momento como programarlo para después. Ambas opciones son necesarias.
4.2 ✅ La cola de mensajes programados opera principalmente a nivel de campaña completa que se dispara en una fecha específica, aunque también se debe permitir programar mensajes individuales para contactos específicos. Además se debe tener en cuenta los rate limits de la API de Meta para evitar bloqueos y para apis no oficiales como WAHA y EvolutionApi que no tienen rate limits, se debe implementar un sistema de control de velocidad para evitar bloqueos por parte de Meta.
4.3 ✅ Cuando llega un evento desde fuera, necesitan evaluar condiciones como: "si el contacto ya está en la base NO enviar", "si el país es Colombia enviar mensaje A, si es México enviar B", "si el contacto tiene la etiqueta 'cliente' enviar mensaje C". Estas condiciones deben ser configurables por el usuario para cada webhook/automatización y no solo están en función del país del contacto sino que pueden estar relacionadas con los campos personalizados las etiquetas, etc. De hecho puede ser el resultado de un análisis por parte de un modelo de lenguaje que procese la información del contacto y determine qué mensaje enviar.
4.4 ✅ Sí, necesitan encadenar acciones en el tiempo para crear flujos de automatización más complejos. Por ejemplo: "enviar mensaje de bienvenida al registrarse → esperar 24 horas → enviar recordatorio", o "enviar mensaje de oferta al detectar que el contacto tiene la etiqueta 'interesado' → esperar 48 horas → enviar mensaje de seguimiento". Estos flujos deben ser configurables por el usuario y permitir condiciones de ramificación basadas en las respuestas del contacto o en cambios en sus datos.
4.5 ✅ Los mensajes pueden ser tanto plantillas aprobadas por Meta (HSM) como mensajes de sesión (respuestas a conversaciones activas). La plataforma debe permitir gestionar ambos tipos de mensajes y asegurarse de que se cumplen las reglas de uso de cada uno según la API de WhatsApp Business de Meta. Si se está usando una API no oficial sin restricciones de plantillas, la plataforma debe incluir un sistema de validación para evitar que se envíen mensajes que podrían resultar en bloqueos por parte de Meta.
4.6 ✅ La plataforma debe gestionar las respuestas que llegan de los clientes, se debe poder establecer una conversación bidireccional. Esto incluye una bandeja de entrada donde los usuarios puedan ver y responder a los mensajes entrantes, así como la capacidad de configurar vincular a una campaña masiva un agente de inteligencia artificail (bot) que atienda los mensajes, pero que además cuando el contacto solicite atención humana pueda notificar y pausar el bot para pasar a atención humana.
4.7 ✅ La plataforma debe permitir registrar manualmente acciones de seguimiento sobre un contacto, como agregar notas, cambiar etiquetas o asignar el contacto a un agente específico. Esto es importante para que los usuarios puedan llevar un control detallado de las interacciones con cada contacto y personalizar su seguimiento según la información disponible.

---

## 5. Restricciones no funcionales

| # | Pregunta | Prioridad |
|---|----------|-----------|
| 5.1 | ¿Cuántos mensajes estiman enviar al mes en total (todos los clientes combinados)? Rangos orientativos: menos de 10 000, entre 10 000 y 100 000, más de 100 000. | 🔴 |
| 5.2 | ¿Cuántos contactos totales esperan manejar en la base de datos al inicio y en un año? | 🟡 |
| 5.3 | ¿La plataforma debe funcionar bien en celular (diseño responsivo) o se usará principalmente desde computadora? | 🟡 |
| 5.4 | ¿Necesitan una app móvil (iOS/Android) o con que funcione en el navegador del celular es suficiente? | 🟡 |
| 5.5 | ¿Cuántos usuarios simultáneos esperan tener usando la plataforma al mismo tiempo en un momento de pico? | 🟢 |

Respuestas:
5.1. ✅ Se estima enviar entre 10 000 y 100 000 mensajes al mes en total, considerando el crecimiento proyectado de la base de clientes y la frecuencia de las campañas.
5.2. ✅ Se espera manejar inicialmente alrededor de 10 000 contactos en la base de datos, con un crecimiento proyectado a 50 000 contactos en un año, dependiendo de la adquisición de nuevos clientes y la expansión de las campañas.
5.3. ✅ La plataforma debe funcionar bien en celular con un diseño responsivo, ya que muchos usuarios podrían necesitar acceder a ella desde sus dispositivos móviles para gestionar campañas sobre la marcha. Sin embargo, también se espera que una parte significativa de los usuarios la utilice desde computadora para tareas más complejas como la configuración de campañas y análisis de datos.
5.4. ✅ No es necesaria una app móvil nativa para iOS/Android, con que funcione bien en el navegador del celular es suficiente. Esto permitirá un desarrollo más ágil y una experiencia de usuario consistente sin la necesidad de gestionar múltiples versiones de una app nativa.
5.5. ✅ Se espera tener hasta 100 usuarios simultáneos usando la plataforma al mismo tiempo en momentos de pico, especialmente durante campañas importantes o lanzamientos. La plataforma debe ser capaz de manejar esta carga sin degradar significativamente el rendimiento o la experiencia del usuario.
---

## 6. Seguridad y cumplimiento

| # | Pregunta | Prioridad |
|---|----------|-----------|
| 6.1 | ¿Los contactos que van a recibir mensajes han dado su consentimiento explícito para ser contactados por WhatsApp? ¿Tienen registro de ese consentimiento? | 🔴 |
| 6.2 | ¿Sus clientes finales son de Colombia, de otros países latinoamericanos, o también de España/Europa? (Esto afecta si aplica GDPR o la Ley 1581 de Colombia.) | 🔴 |
| 6.3 | ¿Deben cumplir con la Ley 1581 de Colombia (Habeas Data) para el manejo de datos personales? ¿Ya cuentan con política de privacidad? | 🟡 |
| 6.4 | ¿Necesitan un mecanismo de "opt-out" (botón de baja) automático para que un contacto pueda pedir que no le envíen más mensajes? | 🟡 |
| 6.5 | ¿Los datos de los clientes deben almacenarse en Colombia o puede ser en servidores en otro país (AWS, Google Cloud, etc.)? | 🟢 |

Respuestas:
6.1. ✅ Sí, los contactos que van a recibir mensajes han dado su consentimiento explícito para ser contactados por WhatsApp, y se cuenta con un registro de ese consentimiento para cumplir con las regulaciones de privacidad.
6.2. ✅ Los clientes finales son principalmente de Colombia y otros países latinoamericanos, no se espera tener clientes en España/Europa. Por lo tanto, la plataforma debe cumplir tanto con la Ley 1581 de Colombia (Habeas Data) para garantizar la protección de datos personales de todos los usuarios pero no es necesario cumplir con GDPR a menos que se expanda a clientes en Europa en el futuro.
6.3. ✅ Sí, deben cumplir con la Ley 1581 de Colombia (Habeas Data) para el manejo de datos personales, lo que implica implementar medidas de seguridad adecuadas para proteger la información de los contactos y garantizar que se maneje de manera responsable. Además, ya cuentan con una política de privacidad que se aplicará a la plataforma.
6.4. ✅ Sí, necesitan un mecanismo de "opt-out" automático para que un contacto pueda pedir que no le envíen más mensajes. Esto es fundamental para respetar la voluntad de los usuarios y cumplir con las regulaciones de privacidad. El sistema debe procesar automáticamente las solicitudes de baja y asegurarse de que los contactos que opten por no recibir mensajes sean excluidos de futuras campañas.
6.5. ✅ Los datos de los clientes pueden almacenarse en servidores en otro país, como AWS o Google Cloud, siempre y cuando se cumplan las regulaciones de privacidad aplicables y se implementen medidas de seguridad adecuadas para proteger la información. No es necesario que los datos se almacenen exclusivamente en Colombia, lo que permite mayor flexibilidad en la elección de proveedores de servicios en la nube.
---

## 7. Integraciones

| # | Pregunta | Prioridad |
|---|----------|-----------|
| 7.1 | ¿Qué proveedor de API de WhatsApp van a usar? ¿Ya tienen acceso a la API oficial de Meta (WhatsApp Business API / Cloud API), o van a usar un intermediario como Twilio, 360dialog, MessageBird? | 🔴 |
| 7.2 | ¿Desde qué plataformas específicas llegarán los webhooks? (WordPress, Wix, Hotmart, Manychat, Google Ads, Meta Lead Ads, etc.) | 🟡 |
| 7.3 | ¿Necesitan conectarse a algún CRM o herramienta que ya usen hoy? (HubSpot, Zoho, ActiveCampaign, Mailchimp, etc.) | 🟡 |
| 7.4 | ¿Necesitan integración con pasarelas de pago para detectar compras y disparar mensajes? (ePayco, Wompi, PayU, Stripe) | 🟢 |
| 7.5 | ¿Necesitan alguna integración con plataformas de cursos online? (Hotmart, Teachable, LearnDash, Moodle) | 🟢 |

Respuestas:
7.1. ✅ Se usará la API oficial de Meta (WhatsApp Business API / Cloud API) y para algunos casos se usarán apis no oficiales como WAHA o EvolutionApi.
7.2. ✅ Los webhooks llegarán principalmente desde plataformas como WordPress, Wix, Hotmart, Manychat, Meta Lead Ads, aunque también se debe permitir la configuración de webhooks personalizados para integraciones con otras plataformas que puedan surgir en el futuro.
7.3. ✅ No, de momento solo es necesaria la gestión de contactos y campañas dentro de la plataforma, no es necesario integrarse con CRM externos. Sin embargo, se debe diseñar la arquitectura de la plataforma de manera modular para permitir futuras integraciones con CRM como HubSpot, Zoho, ActiveCampaign o Mailchimp si se decide expandir las funcionalidades en el futuro.
7.4. ✅ Sí, necesitan integración con pasarelas de pago pero para el manejo de las suscripciones y pagos de los clientes de la plataforma, no es necesario detectar compras para disparar mensajes. La integración con pasarelas como ePayco, Wompi, PayU o Stripe se utilizará principalmente para gestionar las suscripciones y facturación de los usuarios de la plataforma.
---

## 8. Despliegue y mantenimiento

| # | Pregunta | Prioridad |
|---|----------|-----------|
| 8.1 | ¿Quién va a administrar técnicamente la plataforma después de entregada? ¿EduNet tiene alguien técnico que pueda hacer actualizaciones y monitoreo? | 🔴 |
| 8.2 | ¿Prefieren que la plataforma corra en la nube (AWS, Google Cloud, Railway, Vercel) o necesitan instalarla en un servidor propio? | 🔴 |
| 8.3 | ¿Necesitan soporte para múltiples números de WhatsApp (una por cada cliente final, por ejemplo)? | 🔴 |
| 8.4 | ¿Quieren un dominio propio para la plataforma (ej: app.edunet.com) o pueden usar un subdominio del proveedor de hosting? | 🟢 |
| 8.5 | ¿Tienen preferencia de proveedor de nube o de tecnología para el backend/frontend? (PHP, Node.js, Python, etc.) | 🟢 |

Respuestas:
8.1. ✅ Después de entregada, la plataforma será administrada técnicamente por el equipo de EduNet, que cuenta con personal técnico capaz de hacer actualizaciones y monitoreo básico. Sin embargo, se espera que el desarrollador original esté disponible para soporte y mantenimiento durante un período inicial para asegurar una transición suave y resolver cualquier problema que pueda surgir.
8.2. ✅ La plataforma debe ser desplegable en VPS con PaaS como Dokploy o en Vercel. Esto permitirá una mayor flexibilidad en el despliegue y facilitará el mantenimiento a largo plazo, ya que no dependerá de un proveedor específico de nube y podrá adaptarse a las necesidades cambiantes del proyecto.
8.3. ✅ Sí, necesitan soporte para múltiples números de WhatsApp, especialmente si cada cliente final va a tener su propia cuenta aislada. Esto implica que la plataforma debe ser capaz de gestionar múltiples conexiones a la API de WhatsApp Business de Meta, cada una asociada a un número diferente, y asegurarse de que los mensajes se envíen desde el número correcto según el cliente que esté utilizando la plataforma.
8.4. ✅ Sí, quieren un dominio propio para la plataforma, como app.edunet.com, para brindar una experiencia de marca más profesional y confiable a los usuarios. Esto también facilitará la gestión de la plataforma y permitirá una mayor personalización en el futuro.
8.5. ✅ Se debe trabajar con Nextjs Fullstack (React + Node.js) para el desarrollo del backend y frontend, ya que es una tecnología moderna, ampliamente utilizada y con una gran comunidad de soporte. Además, Next.js ofrece ventajas como el renderizado del lado del servidor (SSR) y la generación de sitios estáticos (SSG), lo que puede mejorar el rendimiento y la experiencia del usuario en la plataforma.
---

## 9. Criterios de éxito

| # | Pregunta | Prioridad |
|---|----------|-----------|
| 9.1 | ¿Cómo van a medir que la plataforma está funcionando bien? ¿Por número de mensajes enviados exitosamente, por tasa de apertura, por clientes captados, por otra métrica? | 🟡 |
| 9.2 | ¿Necesitan reportes o estadísticas dentro de la plataforma? ¿Cuáles? (mensajes enviados/fallidos, apertura, clics, campañas activas) | 🟡 |
| 9.3 | ¿Cuál sería el escenario mínimo con el que estarían satisfechos para un lanzamiento inicial (MVP)? ¿Qué funcionalidades son imprescindibles desde el día 1? | 🔴 |
| 9.4 | ¿Qué considerarían un fracaso del proyecto? ¿Hay algo específico que definitivamente NO debe pasar? | 🟢 |

Respuestas:
9.1. ✅ Van a medir que la plataforma está funcionando bien principalmente por el número de mensajes enviados exitosamente y por la tasa de apertura y la tasa de respuesta, pero el enfoque principal estará en asegurar que los mensajes se envíen correctamente y que los usuarios puedan gestionar sus campañas de manera efectiva.
9.2. ✅ Sí, necesitan reportes o estadísticas dentro de la plataforma que incluyan métricas como mensajes enviados exitosamente, mensajes fallidos, tasa de apertura, tasa de clics en enlaces incluidos en los mensajes, número de campañas activas y rendimiento de cada campaña. Estos reportes ayudarán a los usuarios a analizar la efectividad de sus campañas y tomar decisiones informadas para futuras estrategias de comunicación. Además se debe incluir reportes a nivel super admin para que el equipo de EduNet pueda monitorear el uso general de la plataforma y detectar posibles problemas o áreas de mejora y metricas relacionadas con la facturación y el consumo de mensajes por parte de los clientes.
9.3. ✅ El escenario mínimo para un lanzamiento inicial (MVP) incluiría las siguientes funcionalidades imprescindibles desde el día 1: gestión de contactos (importación y almacenamiento), creación y envío de campañas masivas, programación de mensajes, gestión de webhooks para automatizaciones básicas, soporte para plantillas de mensajes aprobadas por Meta, y una interfaz de usuario funcional tanto en computadora como en celular. Además, el MVP debe incluir un sistema de autenticación para los usuarios y una estructura básica de roles y permisos para garantizar la seguridad y el control de acceso a la plataforma.
9.4. ✅ Considerarían un fracaso del proyecto si la plataforma no puede enviar mensajes de manera confiable a través de la API de WhatsApp Business de Meta, si los usuarios no pueden gestionar sus campañas de manera efectiva, o si la plataforma no cumple con los requisitos de seguridad y privacidad establecidos. Además, un fracaso sería si la plataforma no puede escalar para manejar el volumen de mensajes y contactos esperado, o si los usuarios encuentran la experiencia de usuario tan complicada o frustrante que no quieran usarla. Otro escenario de fracaso sería si la plataforma no puede integrarse correctamente con las herramientas y servicios que los clientes necesitan, lo que limitaría su utilidad y atractivo en el mercado. En resumen, el proyecto sería considerado un fracaso si no logra cumplir con los objetivos de negocio y las necesidades de los usuarios de manera efectiva y confiable.
---

## 10. Restricciones de proyecto

| # | Pregunta | Prioridad |
|---|----------|-----------|
| 10.1 | ¿Tienen un presupuesto definido o aproximado para el desarrollo de esta plataforma? | 🔴 |
| 10.2 | ¿Tienen alguna fecha objetivo para tener un primer prototipo o versión funcional? | 🔴 |
| 10.3 | ¿El desarrollo lo haré yo solo o habrá más personas del equipo (diseñadores, QA, otros desarrolladores) involucradas? | 🟡 |
| 10.4 | ¿Tienen ya alguna identidad visual definida (colores, logo, tipografía) que deba aplicarse a la plataforma? | 🟡 |
| 10.5 | ¿Hay alguna tecnología o stack técnico que ya tengan contratado o que sea obligatorio usar (hosting, base de datos, lenguaje)? | 🟢 |

Respuestas:
10.1. ✅ Sí, tienen un presupuesto aproximado para el desarrollo de esta plataforma, aunque prefieren no compartirlo directamente. Sin embargo, es importante que el desarrollo se ajuste a un rango de costos razonable para asegurar la viabilidad del proyecto y permitir futuras iteraciones y mejoras sin comprometer la calidad o la funcionalidad de la plataforma.
10.2. ✅ Sí, tienen una fecha objetivo para tener un primer prototipo o versión funcional, que es dentro de 2 meses. Esta fecha es importante para poder comenzar a probar la plataforma con usuarios reales y obtener feedback temprano que permita ajustar el desarrollo en función de las necesidades y expectativas de los clientes. Sin embargo, también están abiertos a discutir esta fecha si es necesario para asegurar que el prototipo cumpla con los requisitos mínimos de funcionalidad y calidad.
10.3. ✅ El desarrollo lo haré yo solo, aunque habrá colaboración con el equipo de EduNet para el diseño de la experiencia de usuario, la definición de los flujos de trabajo y la validación de funcionalidades. No habrá un equipo formal de QA, pero se realizarán pruebas internas y se buscará feedback de usuarios reales para asegurar que la plataforma funcione correctamente y cumpla con las expectativas antes de un lanzamiento más amplio.
10.4. ✅ Sí, tienen una identidad visual definida que incluye colores, logo y tipografía que deben aplicarse a la plataforma para mantener la coherencia de marca. Proporcionarán los recursos necesarios para asegurar que el diseño de la plataforma refleje la identidad visual de EduNet y brinde una experiencia de usuario atractiva y profesional.
10.5. ✅ No hay una tecnología o stack técnico obligatorio que ya tengan contratado, lo que permite flexibilidad en la elección de herramientas y tecnologías para el desarrollo de la plataforma. Sin embargo, se prefiere trabajar con Next.js para el desarrollo del frontend y backend, y se espera que la plataforma sea desplegable en VPS con PaaS como Dokploy o en Vercel para facilitar el mantenimiento y la escalabilidad a largo plazo.

---

## Supuestos seguros (no preguntar al cliente)

Estas son cosas que el dominio del negocio hace evidentes. Asumirlas ahorra tiempo de reunión.

| # | Supuesto | Justificación |
|---|----------|---------------|
| S1 | **Los mensajes se enviarán vía WhatsApp Business API de Meta o Mediante Apis No Oficiales como WAHA o EvolutionAPI**, Cada cliente puede tener multiples cuentas oficiales y no oficiales. | No todos los usos de Whatsapp requieren la api oficial y la ventana de 24 horas limita algunos casos de uso. Por ejemplo se puede usar para enviar notificaciones a los usuarios (no a los clientes) |
| S2 | **La plataforma será una aplicación web**, no una app nativa iOS/Android como producto principal. | El cliente es una pequeña empresa (5-10 personas) de consultoría digital. El costo de desarrollo y distribución de apps nativas multiplica el presupuesto. Una PWA responsiva cubre el 95% de sus necesidades operativas. |
| S3 | **Los mensajes masivos deben respetar los límites de velocidad de envío de la API de Meta** (rate limits por número de teléfono). | Esto no es una decisión de diseño, es una restricción de infraestructura impuesta por Meta. Excederlos resulta en bloqueos temporales o permanentes del número. |
| S4 | **Las plantillas de mensajes masivos (fuera de ventana de 24h) deben estar pre-aprobadas por Meta (HSM)**. | Es el comportamiento estándar de la WhatsApp Business API. No preguntar al cliente porque es un requisito no negociable de la plataforma subyacente. |
| S5 | **El sistema necesita persistencia de datos en base de datos relacional o documental**, no archivos planos ni hojas de cálculo. | El volumen de contactos, campañas y mensajes que describe el cliente (bases de datos importables, historial de envíos, segmentación) requiere un motor de base de datos real desde el día 1. |
| S6 | **El panel de administración necesitará autenticación con usuario y contraseña como mínimo**. | Es el piso mínimo de seguridad para cualquier aplicación con datos de clientes. No tiene sentido preguntar si quieren autenticación — la pregunta correcta es QUÉ tipo (ver 2.5). |
| S7 | **Los envíos programados se gestionarán con una cola de trabajos en background**, no con consultas sincrónicas. | Un sistema que envía mensajes masivos en fechas futuras no puede depender de que alguien esté conectado en ese momento. Esto es arquitectura, no una preferencia del cliente. |
| S8 | **El cliente no tiene restricciones de GDPR europeo** si opera solo en Colombia y Latinoamérica. | Aplica la Ley 1581 de Colombia (Habeas Data), no GDPR. Solo cambia si tienen usuarios en España/Europa (ver pregunta 6.2). |

---

## 11. Preguntas derivadas de la exploración del dominio

> **Origen:** Estas preguntas NO surgen del intake inicial. Surgieron durante la fase de **exploración del dominio** (ver `02-exploration.md`, sección 6). Son hallazgos que aparecen al mapear capabilities, entidades, riesgos y decisiones tempranas del dominio, y que el cliente todavía no respondió.
>
> Se mantiene la misma leyenda de prioridad de las secciones 1–10 y se filtran las preguntas ya cubiertas por respuestas previas.

### 11.1 WhatsApp y reglas de Meta

| # | Pregunta | Prioridad |
|---|----------|-----------|
| 11.1.1 | ¿El cliente entiende y acepta que Cloud API exige **plantillas pre-aprobadas** + **ventana de 24h** + **opt-in explícito** para mensajes salientes fuera de conversación activa? Esto cambia el flujo "marketing masivo" tradicional y limita lo que se puede hacer con la API oficial. | 🔴 |
| 11.1.2 | ¿El cliente final aporta **su propio número de WhatsApp Business verificado**, o EduNet actúa como BSP intermediario que provisiona el número? Define el modelo de onboarding y quién paga la verificación de Meta. | 🔴 |
| 11.1.3 | ¿Qué política se aplica para **activar canales con APIs no oficiales (WAHA / EvolutionAPI)**? ¿Disclaimer aceptado con timestamp, checkbox simple, o aprobación manual del super admin? | 🟡 |

Respuestas:
11.1.1. ✅ Sí, el cliente entiende y acepta que la Cloud API de Meta exige plantillas pre-aprobadas, una ventana de 24 horas para mensajes salientes fuera de conversación activa, y un opt-in explícito para los contactos que serán enviados mensajes. El cliente reconoce que estas restricciones afectan el flujo tradicional de marketing masivo, pero está dispuesto a adaptarse a estas reglas para garantizar el cumplimiento con las políticas de Meta y evitar bloqueos de números o cuentas.
11.1.2. ✅ El cliente final aportará su propio número de WhatsApp Business verificado, lo que implica que cada cliente será responsable de la verificación de su número con Meta. EduNet actuará como un facilitador en el proceso de onboarding, proporcionando orientación y soporte para la verificación, pero no actuará como un BSP intermediario que provisiona números. Esto significa que cada cliente deberá gestionar su propia relación con Meta para la verificación de su número, y EduNet se centrará en ofrecer una plataforma que les permita utilizar ese número de manera efectiva una vez que esté verificado.
11.1.3. ✅ Para activar canales con APIs no oficiales como WAHA o EvolutionAPI, se aplicará una política de disclaimer aceptado con timestamp. Esto significa que los usuarios deberán aceptar explícitamente un aviso que explique los riesgos y limitaciones de usar APIs no oficiales, y se registrará la aceptación con un timestamp para tener un registro de cuándo se aceptó el disclaimer. Esta política ayudará a EduNet a gestionar el riesgo asociado con el uso de APIs no oficiales, asegurando que los usuarios estén informados y que se pueda demostrar que se les advirtió sobre los posibles problemas de usar estas APIs, como bloqueos por parte de Meta o falta de soporte oficial.

### 11.2 Inbox y operación

| # | Pregunta | Prioridad |
|---|----------|-----------|
| 11.2.1 | ¿Cuántos **operadores simultáneos típicos** tendrá una organización promedio (1, 2-5, 6-15, más)? Define dimensiones del UI, modelo de asignación y límites por plan. | 🟡 |
| 11.2.2 | Además de notas y asignación a agente (ya confirmadas en 4.7), ¿se requieren **menciones a otros operadores** (`@usuario`) y **SLA timers** (alerta si una conversación queda sin respuesta más de N minutos)? ¿O eso es post-MVP? | 🟢 |
| 11.2.3 | Cuando entra un mensaje al Inbox, ¿se envían **notificaciones push o por correo** al operador, o solo se ve si está mirando la pantalla? | 🟡 |
| 11.2.4 | ¿Existe un concepto de **horario de atención**? Si llega un mensaje fuera de horario, ¿se responde con un mensaje automático, se rutea a un bot, o queda en cola hasta el siguiente turno? | 🟡 |

Respuestas:
11.2.1. ✅ Una organización promedio tendrá entre 2 y 5 operadores simultáneos. Esto implica que la interfaz de usuario debe estar diseñada para facilitar la colaboración entre varios operadores, permitiendo la asignación de conversaciones a diferentes operadores y la visualización clara de quién está manejando cada conversación. Además, los planes de suscripción podrían tener límites en la cantidad de operadores permitidos por organización, con opciones para aumentar ese límite en planes superiores.
11.2.2. ✅ Además de notas y asignación a agente, no se requieren menciones a otros operadores ni SLA timers en la versión MVP. Estas funcionalidades pueden ser consideradas para futuras iteraciones de la plataforma, pero el enfoque inicial estará en asegurar que los operadores puedan gestionar las conversaciones de manera efectiva con las herramientas básicas de notas y asignación. La implementación de menciones y SLA timers puede agregar complejidad al desarrollo y a la experiencia del usuario, por lo que se priorizará la simplicidad y funcionalidad esencial en el lanzamiento inicial.
11.2.3. ✅ Cuando entra un mensaje al Inbox, se envían notificaciones push al operador para alertarlo de la nueva conversación. Esto es importante para garantizar que los operadores puedan responder de manera oportuna a los mensajes entrantes, especialmente si no están constantemente monitoreando la pantalla. Las notificaciones por correo electrónico no son necesarias en esta etapa, ya que las notificaciones push en la aplicación deberían ser suficientes para mantener a los operadores informados sobre las nuevas conversaciones.
11.2.4. ✅ Sí, existe un concepto de horario de atención. Si llega un mensaje fuera de horario, se responde automáticamente con un mensaje que informa al contacto sobre el horario de atención y les indica que su mensaje será atendido en el siguiente turno. Esto ayuda a gestionar las expectativas de los clientes y a garantizar que los operadores puedan mantener un equilibrio entre su vida laboral y personal, sin la presión de responder a mensajes fuera de horario. Además, esta funcionalidad puede ser configurable por el usuario para adaptarse a las necesidades específicas de cada negocio, permitiendo personalizar el mensaje automático y definir los horarios de atención según sus operaciones.
---

### 11.3 Automatización

| # | Pregunta | Prioridad |
|---|----------|-----------|
| 11.3.1 | Sobre las ramificaciones confirmadas en 4.4: ¿necesitan **branching basado en el resultado de una acción intermedia** (ej: "si el `http_request` devuelve 200 hacé X, si devuelve error hacé Y")? ¿O las ramificaciones solo se evalúan al inicio del flujo sobre datos del contacto? | 🟡 |
| 11.3.2 | ¿Se requieren **variables compartidas entre acciones de un mismo flow** (ej: la respuesta de un `http_request` se inyecta como variable en el `send_message` siguiente)? | 🟡 |
| 11.3.3 | ¿Un flow puede **disparar la ejecución de otro flow** (composición), o cada flow es siempre independiente? | 🟢 |

Respuestas:
11.3.1. ✅ Las ramificaciones se evalúan principalmente al inicio del flujo sobre datos del contacto, como etiquetas, campos personalizados o información demográfica. No es necesario que haya branching basado en el resultado de una acción intermedia como un `http_request`. Esto simplifica la lógica de los flujos de automatización y reduce la complejidad del desarrollo, permitiendo que los usuarios configuren sus campañas de manera más sencilla sin tener que preocuparse por manejar errores o resultados intermedios dentro del mismo flujo.
11.3.2. ✅ No se requieren variables compartidas entre acciones de un mismo flow. Cada acción dentro del flujo se ejecuta de manera independiente, y no es necesario que la salida de una acción se inyecte como variable en la siguiente. Esto simplifica la configuración de los flujos de automatización y reduce la complejidad para los usuarios, permitiéndoles centrarse en la lógica general de su campaña sin tener que gestionar variables o dependencias entre acciones.
11.3.3. ✅ Un flow puede disparar la ejecución de otro flow, lo que permite la composición de flujos de automatización más complejos. Esto significa que los usuarios pueden crear flujos modulares y reutilizables, donde un flow principal puede llamar a otros flujos para realizar tareas específicas, como enviar mensajes de seguimiento, realizar consultas a APIs externas o actualizar información de contactos. Esta capacidad de composición facilita la creación de campañas más sofisticadas y personalizadas sin tener que duplicar lógica o crear flujos monolíticos, lo que mejora la escalabilidad y mantenibilidad de las automatizaciones dentro de la plataforma.

### 11.4 CRM

| # | Pregunta | Prioridad |
|---|----------|-----------|
| 11.4.1 | Sobre los campos personalizados confirmados en 3.6: ¿qué **tipos de datos** se necesitan? Mínimo propuesto: texto, número, fecha, dropdown (lista cerrada), checkbox. ¿Falta algún tipo (URL, archivo, multi-select)? | 🟡 |
| 11.4.2 | ¿Se requiere **importación recurrente desde Google Sheets** (sync periódico) o solo CSV/XLSX puntual (ya confirmado en 3.2)? | 🟢 |
| 11.4.3 | Sobre la deduplicación confirmada en 3.4: el alcance del dedupe es **estricto por organización** (un número aparece una sola vez en toda la organización), dado que la organización es el único nivel de tenant. ¿Se confirma esta política? | 🟡 |

Respuestas:
11.4.1. ✅ Los tipos de datos necesarios para los campos personalizados incluyen texto, número, fecha, dropdown (lista cerrada) y checkbox. No se requieren tipos adicionales como URL, archivo o multi-select en esta etapa. Estos tipos de datos cubren la mayoría de las necesidades comunes para segmentación y personalización de mensajes, y permiten a los usuarios almacenar información relevante sobre sus contactos de manera estructurada. La inclusión de estos tipos básicos también facilita la implementación y el uso de los campos personalizados sin agregar complejidad innecesaria en esta fase inicial del desarrollo.
11.4.2. ✅ No se requiere importación recurrente desde Google Sheets. La importación de contactos se realizará a través de archivos CSV/XLSX de manera puntual, según sea necesario. Esto simplifica la integración con Google Sheets y reduce la complejidad del desarrollo, ya que no es necesario implementar un sistema de sincronización periódica. Los usuarios pueden exportar sus datos desde Google Sheets y luego importarlos manualmente a la plataforma cuando necesiten actualizar su base de contactos, lo que es un proceso común y manejable para la mayoría de los casos de uso sin la necesidad de una integración en tiempo real.
11.4.3. ✅ El alcance de la deduplicación es estrictamente por organización. Esto significa que un mismo número de contacto aparece una sola vez dentro de la organización (índice único `(organization_id, phone)`). Esta política mantiene la integridad de los datos, evita confusiones o conflictos por contactos duplicados, y asegura que las campañas se dirijan a la audiencia correcta sin riesgo de enviar mensajes duplicados o contradictorios a un mismo número. Como la organización es el único nivel de tenant, no aplica el escenario de "mismo número en distintos workspaces".

### 11.5 Pricing y planes

| # | Pregunta | Prioridad |
|---|----------|-----------|
| 11.5.1 | ¿Cuál es el **rango de precios objetivo** de los 3 planes (Starter / Pro / Enterprise) en USD o COP? Define cuántos mensajes incluidos, cuántos contactos, cuántos canales de WhatsApp y cuántos operadores entran en cada plan (cada plan se contrata por organización). | 🔴 |
| 11.5.2 | ¿Se ofrece **plan anual con descuento**, solo mensual, o ambos? | 🟡 |
| 11.5.3 | ¿Cómo se cobran los mensajes? ¿**Tarifa única** independiente del provider, o **tarifa diferencial** según Cloud API (más cara, costo Meta) vs WAHA/EvolutionAPI (más barata)? | 🔴 |
| 11.5.4 | ¿Quién absorbe el costo de los **mensajes contabilizados por Meta pero no efectivamente entregados** (ej: número inválido, ventana 24h vencida tras intentar respuesta)? ¿Se descuentan del paquete del cliente o EduNet los absorbe? | 🟡 |
| 11.5.5 | El plan free de prueba (confirmado en 2.4): ¿cuántos **mensajes incluidos** trae, durante cuánto tiempo, y qué pasa al agotarse (bloqueo total, downgrade a solo lectura)? | 🟡 |

Respuestas:
11.5.1. ✅ El rango de precios objetivo para los planes Starter, Pro y Enterprise es el siguiente (cada plan se contrata por organización): el plan Starter tendrá un precio de $19 USD al mes e incluirá hasta 5,000 mensajes, 1,000 contactos, 1 canal de WhatsApp y 2 operadores; el plan Pro tendrá un precio de $39 USD al mes e incluirá hasta 10,000 mensajes, 5,000 contactos, 3 canales de WhatsApp y 5 operadores; el plan Enterprise tendrá un precio personalizado basado en las necesidades del cliente, con mensajes, contactos, canales y operadores ilimitados. Estos precios son competitivos en el mercado y reflejan el valor que la plataforma ofrece a los usuarios, permitiendo a las empresas de diferentes tamaños acceder a las funcionalidades que necesitan según su volumen de mensajes y contactos.

11.5.2. ✅ Se ofrecen ambos planes, tanto mensual como anual con descuento. El plan anual tendrá un descuento del 20% en comparación con el precio mensual, lo que incentiva a los clientes a comprometerse a largo plazo con la plataforma y les brinda un ahorro significativo si planean usar la plataforma durante un período prolongado. Esta opción de pago anual también ayuda a mejorar la retención de clientes y proporciona una mayor estabilidad financiera para el negocio, mientras que el plan mensual ofrece flexibilidad para aquellos que prefieren no comprometerse a largo plazo o que desean probar la plataforma antes de tomar una decisión.

11.5.3. ✅ Se cobra una tarifa diferencial según el provider utilizado para enviar los mensajes. Para mensajes enviados a través de la Cloud API de Meta, se aplicará una tarifa más alta que refleje el costo real que Meta cobra por cada mensaje, mientras que para mensajes enviados a través de APIs no oficiales como WAHA o EvolutionAPI, se aplicará una tarifa más baja que refleje el menor costo asociado con estas opciones. Esta estructura de precios permite a los clientes elegir la opción que mejor se adapte a sus necesidades y presupuesto, al mismo tiempo que asegura que los costos de infraestructura y las tarifas de los proveedores se reflejen de manera justa en el precio que pagan los clientes por el uso de la plataforma.

11.5.4. ✅ El costo de los mensajes contabilizados por Meta pero no efectivamente entregados, como en casos de números inválidos o mensajes que no se pueden enviar debido a la ventana de 24 horas vencida, será absorbido por EduNet. Estos mensajes no se descontarán del paquete del cliente, lo que significa que los clientes no serán penalizados por mensajes que no se entregan debido a circunstancias fuera de su control. Esta política de absorción de costos ayuda a mejorar la satisfacción del cliente y a construir confianza, ya que los clientes no tendrán que preocuparse por cargos inesperados por mensajes que no se entregan, lo que puede ser especialmente importante para empresas que están comenzando a usar la plataforma y aún están aprendiendo a gestionar sus campañas de manera efectiva.

11.5.5. ✅ El plan free de prueba incluirá 200 mensajes gratuitos durante un período de 14 días. Al agotarse los mensajes incluidos en el plan free, el cliente tendrá la opción de actualizar a un plan de pago para continuar utilizando la plataforma con todas sus funcionalidades. Si el cliente no actualiza a un plan de pago después de agotar los mensajes gratuitos, su cuenta se mantendrá activa pero no podrá enviar nuevos mensajes, pero podrá acceder a su dashboard para revisar sus contactos, campañas y estadísticas. Esta política de downgrade permite a los clientes seguir accediendo a su información y les brinda la oportunidad de decidir cuándo actualizar a un plan de pago sin perder acceso a sus datos, lo que puede ayudar a mejorar la retención y la conversión de clientes después del período de prueba.
---

### 11.6 Identidad y onboarding

| # | Pregunta | Prioridad |
|---|----------|-----------|
| 11.6.1 | ¿Qué **idiomas** debe soportar la UI? Default propuesto: Español. ¿Se requiere también Inglés en MVP, o se difiere? | 🟢 |

Respuestas:
11.6.1. ✅ La UI debe soportar Español como idioma principal, ya que el mercado objetivo de la plataforma son clientes en Colombia y otros países latinoamericanos. El soporte para Inglés se puede diferir para una fase posterior, ya que el enfoque inicial estará en atender a los usuarios de habla hispana. Sin embargo, la arquitectura de la plataforma debe ser diseñada desde el principio para permitir la adición de múltiples idiomas en el futuro, lo que facilitará la expansión a mercados internacionales si se decide hacerlo más adelante. Esto implica que los textos de la interfaz de usuario, mensajes y cualquier contenido dinámico deben ser gestionados de manera que puedan ser fácilmente traducidos e internacionalizados sin requerir cambios significativos en el código base.


### 11.7 Arquitectura, datos y extensibilidad

| # | Pregunta | Prioridad |
|---|----------|-----------|
| 11.7.1 | Habeas Data exige **derecho a la portabilidad y eliminación**. ¿La plataforma debe ofrecer **exportación completa de datos por contacto y por organización** (JSON o CSV) y **borrado por solicitud** desde el día 1? | 🔴 |
| 11.7.2 | Más allá del historial de mensajes (6 meses confirmados en 3.3), ¿qué **política de retención** aplica para conversaciones cerradas, registros de consentimiento, audit log y métricas de campaña? | 🟡 |
| 11.7.3 | ¿Se requiere **webhook saliente** para que Notify notifique a sistemas del cliente cuando ocurre un evento (mensaje recibido, opt-out, conversación resuelta)? Es feature común que se pide a los pocos meses. | 🟡 |
| 11.7.4 | ¿Se ofrece **API pública** (REST/GraphQL) para que el cliente final integre Notify con sus propios sistemas, o el acceso es exclusivamente vía dashboard? | 🟡 |
| 11.7.5 | ¿Las **plantillas de mensaje deben soportar múltiples idiomas** (selección automática según `contact.locale`), o se asume un solo idioma por organización? | 🟢 |

Respuestas:
11.7.1. ✅ La plataforma debe ofrecer exportación completa de datos por contacto y por organización en formato JSON o CSV, así como la capacidad de borrado por solicitud desde el día 1 para cumplir con los requisitos de Habeas Data. Esto permitirá a los usuarios ejercer su derecho a la portabilidad y eliminación de datos de manera sencilla y transparente, lo que es fundamental para garantizar la confianza de los usuarios y el cumplimiento de las regulaciones de privacidad. La funcionalidad de exportación y borrado debe ser accesible desde el dashboard de administración, con opciones claras para que los usuarios puedan gestionar sus datos de manera efectiva y cumplir con las solicitudes de los contactos de manera oportuna.
11.7.2. ✅ La política de retención para conversaciones cerradas, registros de consentimiento, audit log y métricas de campaña será de 12 meses. Esto significa que la plataforma almacenará estos datos durante un año, lo que permitirá a los usuarios acceder a su historial de interacciones, revisar los consentimientos otorgados por los contactos, auditar las acciones realizadas en la plataforma y analizar el rendimiento de sus campañas durante un período razonable. Después de 12 meses, estos datos serán eliminados de manera segura para cumplir con las regulaciones de privacidad y evitar la acumulación innecesaria de datos antiguos que ya no son relevantes para los usuarios. Esta política de retención equilibra la necesidad de acceso a datos históricos para análisis y cumplimiento, con la responsabilidad de proteger la privacidad de los usuarios y gestionar los datos de manera ética.
11.7.3. ✅ Sí, se requiere un webhook saliente para que Notify notifique a los sistemas del cliente cuando ocurre un evento como la recepción de un mensaje, un opt-out o la resolución de una conversación. Esta funcionalidad es comúnmente solicitada por los clientes después de unos meses de uso, ya que les permite integrar la plataforma con sus propios sistemas de CRM, ERP u otras herramientas de gestión para automatizar flujos de trabajo y mantener sus datos sincronizados. El webhook saliente debe ser configurable para que los clientes puedan elegir qué eventos desean recibir y a qué URL deben enviarse las notificaciones, lo que les brinda flexibilidad para adaptar la integración a sus necesidades específicas y aprovechar al máximo las capacidades de la plataforma.
11.7.4. ✅ No, en MVP el acceso a la plataforma será exclusivamente vía dashboard, sin una API pública disponible para que el cliente final integre Notify con sus propios sistemas. Esto simplifica el desarrollo inicial y permite enfocarse en ofrecer una experiencia de usuario sólida y funcional a través del dashboard. Sin embargo, la arquitectura de la plataforma debe ser diseñada desde el principio para permitir la adición de una API pública en el futuro, lo que facilitará la integración con sistemas externos y ampliará las posibilidades de uso de la plataforma a medida que evoluciona y crece su base de usuarios así como la demanda de funcionalidades más avanzadas y aplicaciones móviles.
11.7.5. ✅ Las plantillas de mensajes solo se gestionarán en el idioma de la organización; no se requiere soporte para múltiples idiomas en las plantillas. Esto simplifica la gestión de las plantillas y reduce la complejidad del desarrollo, ya que cada organización se asume que opera en un solo idioma. Si un cliente necesita enviar mensajes en múltiples idiomas, puede crear organizaciones separadas para cada idioma, lo que permite mantener un alcance claro y evitar confusiones en la gestión de las plantillas. Esta decisión también facilita el cumplimiento de las regulaciones de privacidad y las políticas de Meta, ya que cada organización puede gestionar sus propios consentimientos y configuraciones de acuerdo con el idioma y la región en la que opera.

---

### Confirmaciones técnicas pendientes (no son para el cliente)

Estas no se preguntan al cliente — se validan con documentación oficial (context7) antes de cerrar el `proposal`. Se registran acá solo para trazabilidad.

| # | Validación | Bloquea |
|---|------------|---------|
| T1 | Better-Auth: el plugin **Organizations** cubre el modelo de tenancy de un solo nivel (`Organization` con roles `owner`/`admin`/`member` y un usuario perteneciendo a varias organizaciones), y cómo modelar `super_admin` global (atributo del `User`, fuera del plugin). | Schema de tenancy |
| T2 | Trigger.dev v3 **Realtime**: madurez para streaming de estado de tasks (campañas, FlowRuns). | Decisión final de realtime para tasks |
| T3 | **Drizzle adapter** oficial para Better-Auth: estabilidad en producción y compatibilidad con Neon serverless driver. | Capa de persistencia |
| T4 | **Neon serverless** + Drizzle: comportamiento bajo carga de jobs concurrentes de Trigger.dev (límites de conexión, pooling). | Capa de infra |

---

## 12. Resolución de PENDIENTES de la visión (§11.3 de `03-vision.md`)

> **Origen:** Las 14 preguntas que quedaron 🔴 PENDIENTES en `03-vision.md` §11.3 fueron consultadas con el cliente. Esta sección registra las respuestas para cerrar el insumo previo al `proposal`. Mantener el orden exacto del documento de visión.

### 12.1. Cantidad de organizaciones objetivo al año 1
✅ **Se estiman 100 tenants en el primer año.** Define sizing de infra y proyección de ingresos para el modelado financiero del SaaS.

### 12.2. SLA de disponibilidad contractual
✅ **99.5% confirmado** (asumido en la visión, validado por el cliente). ~3.6 horas de downtime mensual permitido.

### 12.3. Política de backups y retención
✅ **Esquema escalonado**:
- Diario con retención de los últimos **30 días**.
- Semanal con retención de **6 meses**.
- Mensual con retención de **18 meses**.

Reemplaza el supuesto previo (diario × 30 días). Total de cobertura histórica ~24 meses con costo controlado.

### 12.4. MFA / 2FA
✅ **Diferido a post-MVP.** En MVP el factor adicional implícito viene por Google OAuth y magic link. Agregar TOTP/WebAuthn en una iteración posterior.

### 12.5. Pasarela de pago concreta
✅ **Solo Wompi en MVP.** Arquitectura `PaymentGatewayPort` extensible, pero con un único adapter implementado: **Wompi** (Colombia). Polar.sh y otros se difieren a post-MVP cuando se justifique con clientes fuera de Colombia.

### 12.6. Política de overage exacta
✅ **Sin overage. Modelo simplificado para MVP.**
- El cliente paga **únicamente el valor fijo del plan** a EduNet.
- Los mensajes los **paga el cliente directamente a Meta** desde su propia cuenta Cloud API (BYO-account).
- EduNet NO intermedia el costo de mensajes.

**Implicación crítica sobre el modelo de planes (12.7 / §11.5.1)**:
- Los "mensajes incluidos" en Starter ($19 / 5.000 msj) y Pro ($39 / 10.000 msj) **dejan de tener sentido** como métrica de cobro.
- Los planes deben reformularse en función de lo que SÍ controla la plataforma: **contactos máximos, canales WhatsApp, operadores, flows de automatización, retención**.
- **Esto resuelve la CONTRADICCIÓN** del Plan Pro vs costos Cloud API que estaba pendiente — desaparece automáticamente porque EduNet ya no asume el costo Meta.
- Para canales no-oficiales (WAHA/EvolutionAPI) tampoco hay costo por mensaje a intermediar (son self-hosted o el cliente paga el servicio aparte).

### 12.7. Plan Enterprise — qué configura el SuperAdmin
✅ **El SuperAdmin configura manualmente** para cada organización Enterprise:
- Precio de la suscripción.
- Cantidad de usuarios permitidos.
- Cantidad de mensajes incluidos.
- Cantidad de contactos máximos.
- Cantidad de tareas/flows de automatización.
- Otros límites cuantificables del plan.

Implica un modelo de plan Enterprise como override por organización sobre los límites estándar.

### 12.8. Identidad visual entregable
✅ **Preset de shadcn ya configurado en el proyecto.** Solo falta el logo, que se incorporará cuando sea necesario en el MVP.

Riesgo de retraso en branding (R12) queda mitigado: no bloquea desarrollo.

### 12.9. Webhooks salientes — payload y catálogo de eventos
✅ **OMITIDO en MVP.** Se difiere a post-MVP. Cuando se implemente, la opción tecnológica preferida es **Svix** como motor de webhooks salientes (retries, firmas, dashboards, replay), con catálogo de eventos a definir según estándares del dominio (contactos, mensajes, conversaciones, campañas, opt-out, flow-runs).

**Impacto en `03-vision.md`**:
- §3 "Dentro" → mover "Webhook saliente" a la lista "Fuera (explícitamente)".
- §6 capability `outbound-webhooks` → eliminar del MVP.
- §9 Integraciones → Svix sale de MVP.

### 12.10. Bot de IA en Inbox
✅ **Modelo elegible por el usuario** con API key configurable **por bot**, implementado con **OpenRouter** como gateway unificado de proveedores.

Implica que cada organización trae su propia API key de OpenRouter (BYO-key). El costo de tokens NO lo absorbe EduNet. Selección de modelo (GPT, Claude, Gemini, Llama, etc.) en la UI del bot.

### 12.11. Absorción de costos por mensajes fallidos cobrados por Meta
✅ **No aplica en MVP.** Como el cliente paga directamente a Meta (ver 12.6), EduNet no absorbe ningún costo de mensajería. La pregunta original asumía que EduNet intermediaba el cobro — al simplificar el modelo, la cuestión desaparece. **Equivalente operativo**: 100% del costo lo asume el cliente vía su cuenta Cloud API.

Razón explícita del cliente: "necesito que esto salga pronto y una vez operativa version beta, miramos qué ajustes son necesarios".

Re-evaluar este punto cuando se introduzca un modelo de reventa de mensajería (post-MVP).

### 12.12. Dominio definitivo
✅ **`notify.edunet.com.co`**.

### 12.13. Flujo de verificación del número Cloud API
✅ **Formulario tipo asistente** (wizard) bien documentado dentro de la plataforma. Guía paso a paso al cliente final para que pegue credenciales y complete la verificación con Meta.

Implica desarrollo de UX específico de onboarding del canal Cloud API.

### 12.14. Confirmaciones técnicas T1–T4
✅ **Validar con documentación oficial usando context7** antes de cerrar el `proposal`. Cubre:
- T1 — Better-Auth plugin Organizations + modelo de `super_admin` global.
- T2 — Trigger.dev v3 Realtime madurez productiva.
- T3 — Drizzle adapter oficial para Better-Auth.
- T4 — Neon serverless + Drizzle bajo carga concurrente de Trigger.dev.

---

### Resumen de impacto sobre `03-vision.md`

Estas respuestas convierten **14 🔴 PENDIENTES en ✅ CONFIRMADOS** y obligan a ajustar la visión:

**Cambios al "Dentro" del MVP (§3 / §6)**:
- ❌ **OUT** — Webhook saliente / capability `outbound-webhooks` (diferido).
- ❌ **OUT** — Absorción de costos Meta y tarifa diferencial Cloud API vs no-oficial (cliente paga a Meta directo).
- ❌ **OUT** — "Mensajes incluidos / overage" en planes (modelo de cobro simplificado a fijo por plan).
- ✅ **IN** — Bot IA con BYO-key OpenRouter por bot.
- ✅ **IN** — Wizard de onboarding Cloud API.
- ✅ **IN** — Plan Enterprise con override manual de límites por SuperAdmin.

**NFR (§7)**:
- Agregar volumen objetivo de **100 tenants en año 1**.

**Seguridad (§8)**:
- Backups con esquema escalonado: diario × 30d, semanal × 6m, mensual × 18m.
- MFA diferido a post-MVP (explícito).

**Integraciones (§9)**:
- ✅ **Wompi** (única pasarela en MVP, arquitectura multi-gateway preparada).
- ✅ **OpenRouter** (gateway de IA para bots, BYO-key por organización).
- ❌ Svix sale de MVP (junto con outbound-webhooks).
- ❌ Polar.sh sale de MVP.

**Stack y dominio (§10)**:
- Dominio: `notify.edunet.com.co`.
- Preset shadcn ya configurado en el proyecto.

**Supuestos (§11)**:
- §11.3 PENDIENTES queda **vacío**: las 14 respuestas pasan a §11.1 CONFIRMADOS o se redefinen como decisiones explícitas.

**Riesgos (§12)**:
- R4 (costos Cloud API mal contabilizados) → **DESAPARECE** del riesgo financiero de EduNet (cliente asume el costo Meta).
- R12 (identidad visual) → baja a probabilidad/impacto bajo.
- Aparece **riesgo nuevo**: cliente percibe "poco valor" si solo paga acceso a la plataforma sin paquete de mensajes — necesita comunicación clara del modelo "BYO Cloud API account".

**Modelo de planes (reformulación pendiente)**:
Los planes Starter/Pro/Enterprise dejan de tener "mensajes incluidos" como dimensión de cobro. Se redefinen en función de:
- Contactos máximos.
- Canales WhatsApp permitidos.
- Operadores permitidos.
- Flows/automations permitidos.
- Retención de historial (¿diferenciar 6m vs 12m por plan?).
- Bot IA habilitado (sí/no).
- Acceso a soporte priorizado.

Esta reformulación se cierra en el `proposal`.

