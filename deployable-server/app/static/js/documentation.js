
function createDocumentationOutline() {
    let outline = document.getElementById("documentation-outline")

    if (outline === null) {
        return
    }

    document.querySelectorAll(".documentation-entry").forEach(entry => {
        let liElement = document.createElement("li")
        let aElement = document.createElement("a")

        aElement.href = "#" + entry.id
        aElement.innerText = entry.innerText
        aElement.classList.add("inverted")

        liElement.appendChild(aElement)
        outline.appendChild(liElement)
    })
}

document.addEventListener("DOMContentLoaded", (e) => {
    createDocumentationOutline()
});