const variableFont = (family, filename) => `
/* latin */
@font-face {
  font-family: '${family}';
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url(https://fonts.gstatic.test/${filename}.woff2) format('woff2');
}
`;

module.exports = {
  "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,100..900&display=swap":
    variableFont("Fraunces", "fraunces-variable"),
  "https://fonts.googleapis.com/css2?family=Manrope:wght@200..800&display=swap":
    variableFont("Manrope", "manrope-variable"),
};
