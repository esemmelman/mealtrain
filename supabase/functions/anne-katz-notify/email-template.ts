// Source: Google Doc 1559OWjPDo2YZEN0bGgYMqo-lKKctIRJgYXZ5H1GWxfc, October 5, 2026.
export const EMAIL_TEMPLATE = `Thank YOU for being part of the meal train for Anne Katz.

You are confirmed for <signup-dates>.

Please deliver/have the meal delivered to Anne's home at approx. 5 p.m. the day of unless you pre-arrange with her otherwise. Please also call the day of to let her know you/the delivery is on its way. She'll let you know if she is up for a visit or to just leave the food by the front door on her patio. Please provide the meal in disposable containers. Thank you.


CONTACT INFORMATION
Address: 8672 Harriet Lane, Stanton, CA
Cell Phone #: (714) 801-0916


TYPES OF MEALS


Likes Most everything...NOT Picky.

Suggested Ideas:
* Low salt, please
* Chicken
* Mild - Mexican, Asian, American, Italian, etc. dishes
* Salads
* All kinds of vegetables
* Rice, Pasta
* Soups
* Sandwiches (Subway)

Dislikes:
* Spicy anything
* Heavy sauces

If you have any general questions for the CCC, please email:
sharethecaring@templebethdavid.org`;


// Match the source Google Doc: Comic Sans MS, 14 pt. Escape all supplied text.
export function emailHtml(text) {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  return `<div style="font-family:'Comic Sans MS','Comic Sans',Arial,Helvetica,sans-serif;font-size:14pt;color:#222;line-height:1.4">${escaped.replace(/\r?\n/g, '<br>')}</div>`;
}
