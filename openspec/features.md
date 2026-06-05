## **Gestión de contactos** 

1. La aplicación debe tener la gestión de contactos, con atributos básicos como nombres, apellidos, teléfono, email, direccion, ciudad y empresa. Los únicos datos obligatorios son los nombres, apellidos y teléfono.
2. La aplicación debe ser capaz de importar contactos desde la cuenta de whatsapp usando la api de Kapso/Meta.
3. Se deben poder registrar, modificar y eliminar contactos manualmente mediante un formulario en la aplicación
4. Se deben poder importar contactos mediante archivos csv
5. Se deben poder exportar contactos en archivos csv
7. Se deben poder asignar etiquetas a los contactos (una o varias etiquetas)
8. Se deben poder filtrar los contactos por etiqueta.
9. En el dashboard debe adicionarse una card que muestre la cantidad de contactos de la organización.
10. El listado de contactos debe mostrarse en modo paginado, dado que la lista de contactos por organización puede llegar a ser bastante grande. 
11. El paginador debe ser un componente reutilizable, pues en el futuro lo vamos a necesitar en otros modulos de la aplicación.
12. El paginador debe tener los siguientes elementos:
- Botón para ir a la primera página, a la página anterior, a la página siguiente y a la última página. En medio de los cuatro botones debe mostrar el número de la página actual. Estos botones van al lado izquierdo. 
- En el extremo derecho debe aparecer un selector para que el usuario pueda elegir el número de registros por página. 
- Los botones para avanzar y retroceder entre páginas deben habilitarse y deshabilitarse según corresponda
