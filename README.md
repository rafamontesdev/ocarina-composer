# Compositor de Ocarina

Aplicación web para componer melodías con un piano y convertirlas en partituras con los botones de la ocarina de *The Legend of Zelda: Ocarina of Time* en Nintendo Switch 2.

Hecha solo con HTML, CSS y JavaScript: no necesita instalación ni servidor. Abre `index.html` en el navegador o publícala en GitHub Pages.

Esta misma información (autor, licencia y aviso legal) está en la página `acerca.html`, enlazada desde la cabecera de la aplicación.

## Funciones

* Compón con el piano en pantalla, el teclado del ordenador (A W S E D F T G Y H U J K O L P Ñ) o un teclado MIDI.
* Partitura en pentagrama con el nombre de cada nota y los botones del mando que la tocan.
* Nomenclatura Do Re Mi o C D E, sostenidos o bemoles, y preferencia por stick (⇧ ⇩) o cruceta (↑ ↓).
* Reproducción con sonido de ocarina, transporte de tono y deshacer/rehacer.
* Las partituras se guardan automáticamente en el navegador. Se pueden descargar en PDF, imagen PNG o texto, y hacer copias de seguridad en JSON.

### Atajos de teclado

|Tecla|Acción|
|-|-|
|1 – 5|Redonda, blanca, negra, corchea, semicorchea|
|`.`|Puntillo|
|R|Silencio|
|B|Barra de compás|
|Retroceso|Borrar la nota seleccionada|
|← →|Moverse por la partitura|
|Espacio|Reproducir / parar|
|Ctrl+Z / Ctrl+Y|Deshacer / rehacer|

## Autor

**Rafael Montes Jiménez**, con la ayuda de Claude (asistente de IA de Anthropic).

## Licencia

El código de este proyecto es de uso libre bajo la licencia **Beerware** (revisión 42):

> "THE BEER-WARE LICENSE" (Revision 42):
> Rafael Emilio Montes Jiménez wrote this file. As long as you retain this notice you
> can do whatever you want with this stuff. If we meet some day, and you think
> this stuff is worth it, you can buy me a beer in return.

En español: puedes hacer lo que quieras con este código siempre que conserves este aviso. Si algún día nos encontramos y crees que ha merecido la pena, puedes invitarme a una cerveza.

El software se ofrece **tal cual**, sin garantía de ningún tipo. El autor no se hace responsable de ningún daño o problema derivado de su uso.

### Créditos de terceros

* La tabla de correspondencia entre notas y botones se basa en [nintenxu/ocarina-of-time-note-chart](https://github.com/nintenxu/ocarina-of-time-note-chart), publicada bajo licencia [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Esa parte conserva su licencia original y su atribución.
* Fuentes Cinzel, Inter y Noto Music de [Google Fonts](https://fonts.google.com/), bajo licencia SIL Open Font License.
* La melodía de ejemplo, *Himno de la Alegría* (Ludwig van Beethoven), es de dominio público.

## Aviso legal

Este es un proyecto **no oficial**, creado por un aficionado, sin ánimo de lucro y con fines educativos y de entretenimiento.

**Este proyecto no está afiliado, asociado, autorizado, patrocinado ni respaldado de ninguna forma por Nintendo Co., Ltd., Nintendo of America Inc., Nintendo of Europe GmbH ni ninguna de sus filiales.** El autor no tiene ninguna relación con Nintendo.

*Nintendo*, *Nintendo Switch*, *Nintendo Switch 2*, *The Legend of Zelda*, *Ocarina of Time* y todos los nombres, personajes y elementos relacionados son marcas comerciales o marcas registradas de Nintendo. Todos los derechos sobre ellos pertenecen a sus respectivos propietarios. Se mencionan aquí únicamente con fines descriptivos, para indicar con qué juego es compatible la herramienta.

Este proyecto no incluye ni distribuye ningún recurso del juego: ni gráficos, ni sonidos, ni música, ni código. Los iconos de botones, el sonido de ocarina y el resto de elementos visuales se generan desde cero en el propio código.

Cualquier otra marca citada pertenece a sus respectivos propietarios.

