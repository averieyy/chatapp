// let ws = new WebSocket(`ws://${location.host}/chat`);
let ws = new WebSocket(`ws://localhost:3000/admin`);

let navelements = document.getElementsByClassName("navelement");

let selectednavelement = document.getElementById("mainnav");

for (let navelement of navelements) {
    navelement.addEventListener("click", () => {
        if (navelement != selectednavelement) {
            navelement.classList.add("selected");
            if (selectednavelement)
                selectednavelement.classList.remove("selected");
            selectednavelement = navelement;
        }
    });
}