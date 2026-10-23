function highlightCode() {
    hljs.highlightAll()
}

async function renderTaskTexContent() {
    let texElements = [...document.getElementsByTagName('tex')]

    // note: writing to innerText should prevent any XSS attacks as long as the target element is not of type <script>
    const promises = texElements.map(el => {
        let katexDisplayMode = false
        if (el.classList.contains("center"))
            katexDisplayMode = true
        let toRender = el.innerText
        try {
            katex.render(toRender, el, {
                throwOnError: true,
                displayMode: katexDisplayMode
            })
        }catch (e) {
            let spanErrorElement = document.createElement("span")
            spanErrorElement.classList.add("error", "smaller")
            spanErrorElement.innerText = " => " + e.message + ""

            el.classList.add("mono")
            el.innerText = toRender
            el.appendChild(spanErrorElement)
        }
    });

    await Promise.all(promises);
}

document.addEventListener("DOMContentLoaded", (e) => {
    highlightCode()
    renderTaskTexContent()
});
