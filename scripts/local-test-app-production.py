from __future__ import annotations

import pathlib
import subprocess
import tempfile

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
APP = ROOT / 'src' / 'App.tsx'
REACT = pathlib.Path('/opt/pyvenv/lib/python3.13/site-packages/nbclassic/static/components/react/react.production.min.js')
REACT_DOM = pathlib.Path('/opt/pyvenv/lib/python3.13/site-packages/nbclassic/static/components/react-dom/umd/react-dom.production.min.js')


def main() -> int:
    with tempfile.TemporaryDirectory() as td:
        out = pathlib.Path(td)
        dts = out / 'globals.d.ts'
        dts.write_text(
            "declare var React: any;\n"
            "declare var ReactDOM: any;\n"
            "declare namespace JSX { interface IntrinsicElements { [name: string]: any } }\n",
            encoding='utf-8',
        )
        source = APP.read_text(encoding='utf-8')
        source = source.replace("import { getTelegramContext, TelegramContextError } from './telegram/telegram';\n", '')
        source = (
            "class TelegramContextError extends Error { code: string; constructor(code: string){ super(code); this.code=code; } }\n"
            "function getTelegramContext(_options?: any){ throw new TelegramContextError('TELEGRAM_CONTEXT_REQUIRED'); }\n"
            + source
        )
        if 'function isProductionBuild(): boolean {' in source:
            start = source.index('function isProductionBuild(): boolean {')
            end = source.index('\n}\n\nexport function App', start) + 2
            source = source[:start] + 'function isProductionBuild(): boolean { return true; }' + source[end:]
        source = source.replace('export function App', 'function App')
        source += "\nReactDOM.render(React.createElement(App), document.getElementById('root'));\n"
        test_src = out / 'App.production.tsx'
        test_src.write_text(source, encoding='utf-8')
        subprocess.run(
            ['tsc', str(test_src), str(dts), '--jsx', 'react', '--module', 'none', '--target', 'ES2020', '--skipLibCheck', '--outFile', str(out / 'app.js')],
            check=True,
            cwd=ROOT,
        )
        html = (
            '<!doctype html><html><body><div id="root"></div><script>'
            + REACT.read_text(encoding='utf-8')
            + '</script><script>'
            + REACT_DOM.read_text(encoding='utf-8')
            + '</script><script>'
            + (out / 'app.js').read_text(encoding='utf-8')
            + '</script></body></html>'
        )
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
            page = browser.new_page()
            page.set_content(html, wait_until='domcontentloaded')
            body = page.locator('body').inner_text()
            browser.close()
        if 'Откройте LUMI из Telegram' not in body:
            raise AssertionError(f'Expected Telegram production error, got: {body!r}')
    print('PASS: production shell requires Telegram context')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
