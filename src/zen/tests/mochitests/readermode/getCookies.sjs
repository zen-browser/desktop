function handleRequest(request, response) {
  const cookies = request.hasHeader("Cookie")
    ? request.getHeader("Cookie")
    : "";
  response.write(`
    <!DOCTYPE html>
    <html>
        <head>
            <meta charset="utf-8"/>
        </head>
        <body>
            <p>Cookie: <span id="cookieSpan">${cookies}</span></p>
        </body>
    </html>
  `);
}
