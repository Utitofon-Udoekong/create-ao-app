// Mock for ora package
const mockOra = (text) => ({
  start: () => mockOra(text),
  succeed: () => mockOra(text),
  fail: () => mockOra(text),
  warn: () => mockOra(text),
  info: () => mockOra(text),
  stop: () => mockOra(text),
  clear: () => mockOra(text),
  render: () => mockOra(text),
  frame: () => mockOra(text),
  text: text,
  color: 'cyan',
  spinner: 'dots'
});

module.exports = mockOra;
module.exports.default = mockOra;

