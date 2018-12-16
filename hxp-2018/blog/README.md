# hxp CTF 2018: µblog

**Category:** Web
**Points:** 412
**Solves:** 4

> Check out our newest (super hardened) µblogging platform :>\
> Please report any bugs to the admin (in the challenge)!
>
> Download: [µblog-b342cb10f1395bee.tar.xz](https://2018.ctf.link/assets/files/%C2%B5blog-b342cb10f1395bee.tar.xz)\
> Connection: http://195.201.125.245:7777/

## Write-up
 
### Baby steps

Upon entering the challenge's website we were presented with what appeared to be a simple blog with four main functionalities.
1. A place to change the blog's settings (name and logo).
2. A way to publish your own post, which can contain a text and also a logo.
3. A list of all your posts.
4. A place to report bugs to the admin.

The first thing we tried was to report our website to see whether the admin accessed it, and of course they didn't.

From reading the source code (that was given in the description) we got that it was only possible to send blogs (using the id parameter) to the admin, which eliminated several attack vectors.
```php
if (isset($_POST['report']) && !empty($_POST['c']) && hash_equals($_SESSION['c'], $_POST['c']) && preg_match('/^http:\/\/127.0.0.1\/\?id=[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/', $_POST['report'])){
    include 'backend.php';
    send_to_admin($_POST['report']);
    exit();
}
```

After quickly analyzing the server's source code (and not finding any vulnerabilities) we decided to move on and analyze the application's HTML.

At the end of the page there was the following javascript, which immediately caught our attention:
```javascript
if (!$('#news-container').html())
    $.each($('body').data('posts'),function(i,d) {
        $('#news-container').html($('#news-container').html()+$('#template').html() )
        $('#news-container .post:last .text ').text(d.text)
        $('#news-container .post:last .icon').attr("src",d.icon)
        $('#news-container .post:last .icon').attr("src",d.icon)
        $('#news-container .post:last .link').attr("href",d.url)
        $('#news-container .post:last').attr("id","post-"+d.id)
    })
    $(location.hash).addClass('highlight')
```

On October of this year, [@ArthurSaftnes](https://twitter.com/ArthurSaftnes) released an impressive article ([A timing attack with CSS selectors and Javascript](https://blog.sheddow.xyz/css-timing-attack/)) talking about how it is possible to extract secrets from HTML
if user-controled input is executed inside $() by creatively abusing CSS selectors to create a delay which would allow an attacker to perform a timing attack.

We now had the foundation for an attack (the use of $(location.hash) to steal the admin's blog id), but we faced our first obstacle.

In his attack, the victim needs to access the attacker's website, and as far as we knew, there was no way to make the admin access a page other than an user's blog.

So we moved on again, to search for the other pieces of the puzzle.

### Ping-pong

After our first finding, we started to test the website's endpoints, and while we weren't able to execute any javascript (inputs were being properly sanitized), we discovered that it was possible to set "//attacker.com" as the logo and then the image would end up being loaded from our website (both the settings and the post endpoints were vulnerable).

So we set our logo to "//requestbin.net/r/w6oc2hw6" and reported our blog to the admin and we finally got a hit:

![headers](https://i.imgur.com/MeDD3WF.png)

We now had the confirmation that the admin was accessing our blog and also the version of Google Chrome they were using (so again we ruled out a few more attacks).

This discovery was really interesting, but surely couldn't be used as a way to time the delay caused by the selectors because the images would already have been loaded after reaching $(location.hash), right? ... right?

### Reading between the lines

At this point, it seemed like we had hit a dead end. How were we supposed to detect the delay that would be caused in case we had a match?

After a thorough analyzis of the code, we found our answer. Let's check it line by line:

```javascript
1.   <script>
2.       $('#logo').attr('src', $('body').data('logo'))
3.       $('#name').text($('body').data('name'))
4.   </script>
5.   <div id="template" hidden>
6.       <div class="post">
7.          <div>
8.              <img class="icon">
9.          </div>
10.         <div>
11.             <p class="text"></p>
12.         </div>
13.         <div>
14.             <a class="link">Link</a>
15.         </div>
16.      </div>
17.      <hr>
18.  <div>
19.  <script>
20.      if (!$('#news-container').html())
21.         $.each($('body').data('posts'),function(i,d) {
22.             $('#news-container').html($('#news-container').html()+$('#template').html() )
23.             $('#news-container .post:last .text ').text(d.text)
24.             $('#news-container .post:last .icon').attr("src",d.icon)
25.             $('#news-container .post:last .icon').attr("src",d.icon)
26.             $('#news-container .post:last .link').attr("href",d.url)
27.             $('#news-container .post:last').attr("id","post-"+d.id)
28.         })
29.         $(location.hash).addClass('highlight')
30.  </script>
```

When someone enters a blog, lines 2 and 3 will set the blog's name and logo. So far so good, nothing out of ordinary.

Then, line 20 will check if the ```news-container``` div is empty, which is the case, and because of that jump to line 21.

Line 21 will iterate thought the blog's posts, and lines 22 to 27 will be responsible for inserting each post's information inside the ```news-container``` div.

Finally, after all the posts have been inserted into the page, we get to line 29, which tries to add the highlight class to a div (the id of the div is retrieved from location.hash).

Wait a moment... line 20 doesn't use curly braces, so line 29 isn't part of the if condition. This means that even if the ```news-container``` div isn't empty, line 29 will be triggered. That's interesting...

Let's take a look at line 22 again. The html inside the ```news-container``` div is being inserted into itself plus the html of the ```template``` div. What is the content of the ```template``` div?

The ```template``` div starts at line 5 and ends at line 18.

Oh...

There is a bug in line 18. Instead of closing the div, it is actually opening a new one. So the ```template``` div goes from line 5 to line 30, including the script tag containing the javascript code.

This means that when line 22 is executed, the next javascript code executed won't be the one from line 23, but instead, it will be the one from line 20.

And now, given the ```news-container``` div is not empty anymore, lines 21 to 28 will be skipped and line 29 will be executed (because of the lack of curly braces). After that, the script that was running before resumes from line 23 and only then the posts' information are inserted into the div (including the post's logo).

### Attack plan

With all this information it's possible to devise an attack plan:

1. We set "//attacker.com/firstping" as our blog logo.
2. We create a post with the logo "//attacker.com/secondping".
3. We create a selector that will hang for a few seconds if the n char of body["data-user-id"] matches (selector must not have any spaces because of url encoding).
4. We report our blog to the admin, with the hash we created in step 3 added to it.
4. In our server, we calculate the time it takes between the request to /firstping and /secondping.

The full URL sent to the admin will look something like this:

```http://127.0.0.1/?id=a6142ba5-e88b-4a77-8ec9-94aa45a57855#xxx,*:has(*:has(*:has(*:has(*:has(*:has(*)))))):has(body[data-user-id^='1'])```

If there is no match, the difference between /firstping and /secondping will be something like 20ms. If there is a match, the difference will be about 2000ms.

What is left is automating this process and then leak the full flag.

## Flag

```hxp{PHP_xHTML_CSS_JS_CSP_WTF_Security_._.}```

## Contact

If you have any questions feel free to contact me on [@lbherrera_](https://twitter.com/lbherrera_)
