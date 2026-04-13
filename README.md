# Algebra Capital — KYC Form · Estrutura de Ficheiros

Partial View KYC (Lei n.º 83/2017 · AML/CFT) separada em ficheiros modulares para integração em ASP.NET Core / Razor Pages.

---

## Estrutura de Pastas

```
algebra-kyc/
├── _KycForm.cshtml             ← Partial View principal (ponto de entrada)
├── README.md
├── css/
│   └── kyc.css                 ← Todo o CSS (variáveis, componentes, layouts)
├── js/
│   └── kyc.js                  ← Todo o JavaScript (lógica, i18n, PDF, validação, submit)
├── razor/
│   └── _RazorFields.cshtml     ← Campos hidden Razor + AntiForgeryToken
└── sections/                   ← Fragmentos HTML por secção do formulário
    ├── 01-modal-pdf.html
    ├── 02-modo-banner.html
    ├── 03-toast.html
    ├── 04-progress.html
    ├── 05-cover-ref.html
    ├── 06-sec-A-negocio.html
    ├── 07-sec-B-singular.html
    ├── 08-sec-B-coletiva.html
    ├── 09-sec-rep-legal.html
    ├── 10-sec-pep.html
    ├── 11-sec-documentos.html
    ├── 12-sec-assinaturas.html
    ├── 13-sec-anexo-legal.html
    └── 14-bottom-bar.html
```

---

## Secções do Formulário

| Ficheiro | Secção | Descrição |
|---|---|---|
| `01-modal-pdf.html` | Modal PDF | Pré-visualização e download do PDF gerado |
| `02-modo-banner.html` | Banner de Modo | Toggle Modo Interno ↔ Modo Cliente |
| `03-toast.html` | Toast de Validação | Notificação de campos obrigatórios em falta |
| `04-progress.html` | Barra de Progresso | Progresso por secção (7 steps) |
| `05-cover-ref.html` | Capa + Ref. Interna | Seletor Singular/Coletiva + campos internos (só Modo Interno) |
| `06-sec-A-negocio.html` | **A — Negócio** | Propósito, montante, sinal, fundos, IBAN. ⚠️ Readonly para cliente |
| `07-sec-B-singular.html` | **B — Singular** | Identificação, doc. identificação, fiscal, cônjuge/unido de facto |
| `08-sec-B-coletiva.html` | **B/C — Coletiva** | Empresa: identificação, responsável, RCBE, titulares (≥5% / BE) |
| `09-sec-rep-legal.html` | **Rep. Legal** | Representante legal (condicional, se existir) |
| `10-sec-pep.html` | **PEP** | 4 questões sobre Pessoas Politicamente Expostas (Lei 83/2017) |
| `11-sec-documentos.html` | **Documentos** | Upload documentos obrigatórios (singular/coletiva + origem de fundos) |
| `12-sec-assinaturas.html` | **Assinaturas** | RGPD, declarações, exportar PDF, CMD, upload assinatura física |
| `13-sec-anexo-legal.html` | **Anexo I** | Definições legais (BE, PEP, familiares, associados) |
| `14-bottom-bar.html` | Barra de Ações | Guardar progresso, submeter (fixo no fundo) |

---

## Integração ASP.NET Core

### 1. Model

```csharp
// Models/KycFormModel.cs
public class KycFormModel
{
    public string ClientId   { get; set; }
    public string RefInterna { get; set; }
}
```

### 2. Usar a Partial View

```razor
@* Em Clients/Detail.cshtml ou similar *@
@await Html.PartialAsync("_KycForm", new KycFormModel {
    ClientId   = Model.ClientId,
    RefInterna = Model.KycRef
})
```

### 3. Ficheiros estáticos — wwwroot

Copiar para:
```
wwwroot/
├── css/kyc.css
└── js/kyc.js
```

Referenciar no `_Layout.cshtml` ou na view mãe:
```html
@section Styles  { <link rel="stylesheet" href="~/css/kyc.css" /> }
@section Scripts { <script src="~/js/kyc.js"></script> }
```

### 4. Controller de Submissão

```csharp
// Controllers/KycController.cs
[HttpPost]
[ValidateAntiForgeryToken]
public async Task<IActionResult> Submit([FromForm] KycSubmitDto dto)
{
    // dto.ClientId, dto.ProcessRef — dos campos hidden Razor
    // dto.FormData              — campos do formulário
    // dto.Files                 — ficheiros uploaded (IFormFileCollection)

    // ... processar e guardar
    return Ok(new { success = true, reference = dto.ProcessRef });
}
```

O `submitForm()` em `kyc.js` já está preparado para enviar via `fetch()` para o URL em `kyc_submit_url` com o token CSRF incluído.

---

## Campos Hidden Razor — `razor/_RazorFields.cshtml`

```razor
<input type="hidden" id="kyc_client_id"   value="@Model.ClientId" />
<input type="hidden" id="kyc_process_ref" value="@Model.RefInterna" />
<input type="hidden" id="kyc_submit_url"  value="@Url.Action("Submit", "Kyc")" />
@Html.AntiForgeryToken()
```

Estes campos são lidos no arranque do JavaScript:
```js
var KYC_CLIENT_ID  = document.getElementById('kyc_client_id').value;
var KYC_SUBMIT_URL = document.getElementById('kyc_submit_url').value;
var KYC_CSRF_TOKEN = document.querySelector('input[name="__RequestVerificationToken"]').value;
```

---

## CSS — `css/kyc.css`

### Variáveis de Tema (`:root`)
```css
--bg, --surface, --surface2    /* Fundos (tema claro por defeito) */
--border, --border2            /* Bordas */
--text, --text2, --text3       /* Texto (3 níveis) */
--accent, --accent2, --glow    /* Destaque (preto/cinzento) */
--err, --err-bg                /* Erros */
--ok, --ok-bg                  /* Sucesso */
```

> ⚠️ **Diferença vs ALYX:** Este formulário usa tema claro fixo (branco/cinzento) sem toggle dark/light mode. O acento é preto (`#111`) em vez de dourado.

### Classes de Visibilidade por Modo
| Classe | Comportamento |
|---|---|
| `.internal-section` | Visível apenas em Modo Interno |
| `.readonly-section` | Preenchido pela Algebra; readonly para cliente |
| `.readonly-overlay` | Overlay que bloqueia interação no Modo Cliente |

---

## JavaScript — `js/kyc.js`

### Configuração (lida dos campos Razor)
```js
var KYC_CLIENT_ID  = '...';  // @Model.ClientId
var KYC_SUBMIT_URL = '...';  // @Url.Action("Submit","Kyc")
var KYC_CSRF_TOKEN = '...';  // AntiForgeryToken
```

### Variáveis Globais
```js
var SECTIONS = 7;
var currentLang = 'pt';        // 'pt' | 'en'
var currentType = 'singular';  // 'singular' | 'coletiva'
var currentModo = 'interno';   // 'interno' | 'cliente'
var pdfDoc = null;
var titularCount = 0;
var docFiles = {};
```

### Funções Principais

#### Submissão (integração backend)
```js
function submitForm() {
    // Valida campos + documentos
    // Constrói FormData com todos os campos e ficheiros
    // Envia para KYC_SUBMIT_URL via fetch() com CSRF token
    // Mostra kyc-success ou kyc-error consoante resposta
}
```

#### Modo e UI
| Função | Descrição |
|---|---|
| `toggleModo()` | Alterna Modo Interno ↔ Modo Cliente |
| `applyModo()` | Aplica classes CSS e readonly |
| `setType(type)` | Alterna 'singular' / 'coletiva' |
| `setLang(lang)` | Muda idioma (PT/EN) e atualiza labels |

#### Formulário
| Função | Descrição |
|---|---|
| `toggleChk(el)` | Toggle checkbox multi-seleção |
| `toggleRad(el, grp)` | Toggle radio exclusivo |
| `ynToggle(btn, id, type)` | Toggle Sim/Não com collapse |
| `addTitular()` | Adiciona bloco de titular (Coletiva) |
| `removeTitular(n)` | Remove bloco de titular |

#### Validação e Progresso
| Função | Descrição |
|---|---|
| `validateRequired()` | Valida campos `data-req` |
| `validateDocs()` | Valida uploads obrigatórios |
| `updateProgress()` | Recalcula barra de progresso |

#### PDF
| Função | Descrição |
|---|---|
| `collectFields()` | Recolhe valores do formulário |
| `buildPDF()` | Gera PDF A4 com jsPDF |
| `runExport(skip)` | Valida e abre pré-visualização |
| `downloadPDF()` | Faz download `ALGEBRA_KYC_*.pdf` |

---

## Internacionalização

Objeto `T` em `kyc.js` com chaves `pt` e `en`. Elementos com `id` específicos (ex: `id="a-title"`, `id="e-q1"`) são atualizados por `setLang()`.

> ⚠️ **Diferença vs ALYX:** Este formulário usa `id` em vez de `data-i18n` para as traduções dinâmicas.

---

## Dependências Externas

| Biblioteca | Versão | CDN |
|---|---|---|
| jsPDF | 2.5.1 | `cdnjs.cloudflare.com` |
| Google Fonts | — | Cormorant Garamond + Montserrat |

---

## Feedback de Submissão

Dois elementos de resposta já presentes no HTML:

```html
<div class="kyc-success" id="kyc-success">
    <h2>✓ Formulário submetido com sucesso</h2>
    <p>Referência: <strong id="kyc-success-ref"></strong></p>
</div>
<div class="kyc-error" id="kyc-error"></div>
```

O JS mostra/oculta estes elementos consoante a resposta da API, e preenche `kyc-success-ref` com a referência retornada pelo servidor.
