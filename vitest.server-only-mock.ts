// Mock de "server-only" para os testes: o pacote real lança quando
// `window` existe (nosso ambiente de teste é jsdom), porque em produção
// o Next resolve `server-only` para `empty.js` via a condição de export
// `react-server` — condição que o Vitest/Vite não define. Sem este mock,
// qualquer arquivo de `core/` que declare `import "server-only"` (a
// maioria) não poderia ser testado sob jsdom.
export {};
