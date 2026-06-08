## Item de conversación
1. Los itemes de la lista de conversaciones deben mostrar la hora en la parte superior derecha de cada uno.
2. Cuando una conversación tiene mensajes no leidos, debe mostrar en negrita y el circulo verde con el numerito.
3. Cuando el texto del mensaje que sale debajo del nombre está my largo debe recortarse con puntos suspensivos y mas bien mostrar el contenido completo en un tooltip (title)
4. Incluye el tiempo restante de la ventana de 24 horas en cada item en la segunda linea a la derecha. Si ya se venció, ponemos algun icono que indique visualmente esto, podría ser simplemente que el borde del circulo (foto usuario) esté en rojo, quiza?

## Encabezado del área de chat
1. El nombre permite mostra y ocultar el panel derecho, debería ser cliqueable toda el área del avatar, nombre y número. 
2. Dado el punto 4 del titulo anterior, ya no sería necesario el cartel con la ventana de 24 horas en la parte suprior de la ventana de chat (quítalo). Dejala solo cuando esté vencida la ventana de 24 horas y quita el anuncio inferior que dice: "La ventana de 24 horas está cerrada. Solo puedes escribir mediante una plantilla"
3. Si puedes quitar el header solo en la ruta del inbox estaría genial, pero asegurate que dejar bien ubucado el botón para expandir y contraer el sidebar.

## Refresh de la ventana.
1. Debería haber actualización optimista, para que cuando envio un mensaje se refleje rápidamente en la ventana de chat y tal como lo hace whatsapp no muestra el primer check (palomita) sino un reloj mientras el mensaje realmente se envía.
2. En un change anterior dejamos pendiente el uso de una plataforma externa para realtime (habimos considerado ably, pusher, entre otras). Creo que es momento de implementarla pero me decidí por Centrífugo (https://centrifugal.dev/) y ya lo tengo desplegado, solo dime que variables te paso para implementarlo.

