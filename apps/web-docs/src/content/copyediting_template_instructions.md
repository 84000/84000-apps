**84000 Copyediting Template**

# Introduction to the Template

The Copyediting template ([download here](https://drive.google.com/drive/u/1/folders/1dJB59yYxF98baiq8zuC2sHLGT22vi9jT)) should be used to prepare all 84000 texts in the copyediting phase. This will help the digital editors apply the markup and optimize the process for digital publication.

**Note about this version of the Copyediting Template:**

If you are familiar with previous versions of the Copyediting Template, you may notice that the many character styles for tagging italics have been removed. This is because this semantic tagging has been placed further downstream the publication pipeline to make the workflow more efficient and to allow copyeditors to focus more of their attention on the grammar and style of the projects. For any italics found in the text please leave them simply formatted as italics and their semantic value will be applied later in the markup phase. The only paragraph style that will render italics is the “Trailer” tag, for which instructions are given below.

The paragraph styles regarding the formatting of sections, headings, verses, and so forth are still relevant and the remaining instructions below are nearly synonymous with those found in previous versions of the template. Only the instructions for character styles have been removed.

# Instructions for Style tagging

## A. Sections

When the Word document is converted into the digital format, the outline and divisions of the text will all be determined by the heading styles: “Heading 1,” “Heading 2,” etc., all the way up to “Heading 9.” The standard outline for 84000 has already been set up in this template using the “Heading 1” and “Heading 2” styles. This should make it easy for you, and you will just need to paste in the appropriate sections. Each section in the template will have some brief instructions in brackets explaining how to use the “Heading” styles in that section, but the format is generally uniform throughout the whole document.

For any further subdivisions—whether in the main translation, introduction, or in any other section—apply the numbered “Heading” styles as appropriate. Headings 1 through 9 should all be available in the style menu, and if you go to the “View” tab in the ribbon and check the “Navigation Pane” you should be able to see how the document is outlined according to these headings.

Note that MS Word only allows for an outline with a maximum of nine levels. On occasion there will be complex texts that will require more. If this is the case, don’t create a new heading style for “Heading 10” as this won’t go through the script. For any tenth level subdivision or higher, use the “normal” style and label it with tags in angular brackets &lt; &gt;. For example:

&lt;level 10 div&gt;Section 1.2.1.2.1.5.6.2.1: Vinaya Rules Concerning Pet Alligators&lt;/level 10 div&gt;

## B. Verses

If there are any sections of verse in the text, please select the entire section of verse and apply the “Verse” style from the style set, according to the instructions below.

All verses need to follow the same format, whereby each line within the verse is separated by a line break (this is made by holding the SHIFT key down while hitting the ENTER/RETURN key), and each stanza of verse is separated by a paragraph break (made by hitting the ENTER/RETURN key in the regular manner). As a result, you should see a space between the stanzas of verse but not between the individual lines within the stanza.

It may be the case that the translator used paragraph breaks instead of line breaks for the individual lines of verse and separated their stanzas with double paragraph breaks. You will notice this if, after selecting the text and converting it into the “Verse” style, spaces appear between all the individual lines.

If this is the case, you will need to turn the paragraph breaks into line breaks and the double paragraph breaks into single paragraph breaks. There is a way to automate this with a few find-and-replace commands; you can save some time by using the following instructions. Be careful with find-and-replace commands and always double check to make sure unwanted changes were not made.

\*\*\*Note: Some early versions of MSWord have a bug, in that when one tries to find and replace the line breaks in a certain section, it replaces all the line breaks in the document rather than in just the section that has been selected. Please try this procedure carefully and if you notice this problem, undo the find-and-replace (Ctrl-Z) and don’t worry about formatting the verses. Leave a note for the markup editors and they will take care of the verses during the markup phase.

1. First change the view in MSWord to display all of the invisible line breaks and paragraph breaks. This can help you see more clearly how the breaks are being formatted. In the latest versions of Word you can just toggle the pilcrow “¶” symbol under the “Home” tab, but in older versions you may need to look through the option settings.
2. Go to the “Review” tab and make sure that “Track Changes” is off. You can turn this back on once you are done with the conversion.
3. Select the section of verses you need to tag (you can tag many verses at once as long as there is no prose between them). Make sure you select only the text and don’t overlap the final paragraph mark.
4. Press Ctrl-H.
5. Find: ^p^p _(two paragraph marks in a row)_.
6. Replace: \[paragraph\] _(this is just a place holder)_.
7. Click **Replace All**. It will tell you how many replacements it made in the selection and ask whether you want to continue beyond the selection.
8. Click **No**.
9. Press Ctrl-H. (_This step may be unnecessary if the Find and Replace window stays open_.)
10. Find: ^p _(paragraph mark)_.
11. Replace: ^l _(line-break mark)_.
12. Click **Replace All**. It will tell you how many replacements it made in the selection and ask whether you want to continue beyond the selection.
13. Click **No**.
14. Press Ctrl-H. (_This step may be unnecessary if the Find and Replace window stays open_.)
15. Find: \[paragraph\] _(the place holders you made before)_.
16. Replace: ^p _(paragraph mark)_.
17. Click **Replace All**. It will tell you how many replacements it made in the selection and ask whether you want to continue beyond the selection.
18. Click **No**.
19. You may need to re-apply the “Verse” style at this point if it was stripped away during the find and replace.
20. This will replace all the double paragraph breaks with single paragraph breaks, and all the single paragraph breaks with line breaks. You must follow the steps in this order or else you will lose the paragraph breaks between the verses.

That’s it. Now all paragraph marks are replaced in your selection. Be sure to check and make sure that the find-and-replace operated correctly. If the translator used some unusual format for the sections of verse, you can perhaps use a different sequence of find-and-replace commands. The find-and-replace also seems to work differently depending on the version and format, so you may need to conduct the replacements differently. In some cases you can do this in fewer steps by just replacing the paragraph breaks with line breaks and then the double line breaks with paragraph breaks. However, in some situations the search tool won’t recognize double line breaks (“^l^l”) so this shortcut doesn’t always work. Just remember that in the command window all paragraph breaks will be recognized by a ^p input, and line breaks will be recognized by a ^l input. Again, if this process becomes too messy or complicated, it is fine to leave this last detail for the markup editors.

## C. Block Quotes

Anytime a passage of text is set apart as a block quote, please apply the paragraph style “Block”. This will apply an indent and ensure that the passage is processed correctly.

If the block quote is a verse, use instead the style “Block-Verse” and additionally follow the instructions for formatting verses above (“B. Verses”). If a portion of the block quote is verse, then only apply the “Block-Verse” to the verse section.

These block quotes may also be used for root texts if the present text is a commentary. However, note we may create a more detailed template for commentaries in the future as we develop a workflow for linking root-commentary texts.

## D. Mantra Blocks

In previous versions of the template the instructions for mantras were quite convoluted because of some limitations of the .docx format. This entire process of sematic tagging has now been moved to further down the workflow and conveniently no longer needs to be addressed in the copyediting phase. However, the one formatting style that should be accounted for is when a mantra is formally declared and set off into an indented block. For example:

Then the wandering mendicant proclaimed the following mantra:

Oṁ hrāṁ hrīṁ hrauṁ, in your fierce form, expel, expel! Drive away, drive away! Pull, pull! Shake, shake! Blow up, blow up! Strike, strike! Swallow, swallow! Bind, bind! Crush, crush! Paralyze, paralyze! Oṁ hung phet!

When this is the case, please apply the “Mantra-Block” style, which should indent the paragraph and also ensure that the passage is appropriately formatted in the digital publication.

If the mantra block is in Verse format, apply instead the “Mantra-Block-Verse” style and additionally follow the instructions for formatting verses above (“B. Verses”).

## E. Trailers  

As a standard, we italicize the trailers in our 84000 publications. A trailer is a simple statement from the original translation declaring the end of a chapter, section, or text:

*This was the third chapter in the “Great Sovereign Tantra of Siddhaikavīra.”*

To tag the trailers, please set it apart with a single paragraph break and use the “Trailer” paragraph style; this will italicize the entire statement.

## F. Instructions for Other Types of Formatting

### 1\. Small Caps for Dates ce, bce, and Subscript for Certain Sigla

For any dates using the abbreviations ce or bce (change any instances of AD or BC to these). These should be formatted by applying the “small caps” character style from MS Word. You can apply this in Word by first typing the characters as lower case (it doesn’t work on actual capital letters). Then select them with the cursor, and then clicking the downward-pointing arrow in the corner next to “Font” under the “Home” tab (or Cmd/Ctrl + D). Then check “Small caps” in the dialog box. The script will now be able to find this and convert it into the proper tag for markup.

If small caps unicode has been used for the CE and BCE by the translator this is no good, as it won’t be displayed consistently by all browsers on the 84000 webreader. If you are uncertain whether the translator has used Unicode or not, copy one of the letters and paste it into this website: <https://unicodelookup.com/>. If it says “latin letter small capital \_” that’s no good, and it needs to be replaced (_this will unlikely be an issue since people rarely use these Unicode characters_).

### 2\. Tables

If the translator has entered any tables into the front material, main text, appendices, or notes, the script has now been updated to convert tables, so it is fine to enter them into the template as they appear in the translator’s submitted text.

### 3\. Cross-References

Any cross-references to other texts, published or not yet published, in the Kangyur or Tengyur should be marked with a special code formatted as in the following example:

&lt;Reference Toh 999&gt;

This code itself won’t be displayed in the publication, but will notify the markup editors to create a URL link in the Reading Room to the relevant milestone of the referenced text. Here is an example:

Candraprabha is one of the bodhisattva great beings. He is also the principal interlocutor in _The King of Samādhis Sūtra_.&lt;Reference Toh 127&gt;

In this example the reference will inform the markup editor to create a URL link to Toh 127 for the string, “_The King of Samādhis Sūtra_.” Note that it’s best to insert the tag flush to the passage it references or any punctuation next to it. These tags will be invisible to our readers, but any added spaces will show up erroneously in the published text.

At the end of the Toh reference number, any information that will help the markup editor locate the specific passage may be added, such a folio number, chapter numbers for those long Vinaya texts, or anything else that might be relevant. Some examples:

&lt;Reference Toh 111 F.200.b&gt;  
&lt;Reference Toh 11 section 2.2.4&gt;  
&lt;Reference Toh 1-6 Glossary Term “Stupa”&gt;

The translator guidelines have instructed translators to add their own references in this same manner so you might see that they have already been created, but in some cases they may need to be added in or revised/improved. Typically they should be added to any clearly referenced Kangyur or Tengyur texts in the introduction, notes, glossary definitions, and bibliography.

### 4\. Section Breaks without Headers

By default the script will remove any empty paragraphs, so any paragraph breaks without any text preceding them will disappear. Occasionally one may want to add a section break without a header by using two paragraph breaks in a row. If this is the case, please enter in a &lt;break&gt; code to indicate there is to be an intentional double line break between any two paragraphs. For example, this is usually done after the opening homage. This should be marked in the following manner:

Homage to the Blessed One:

&lt;break&gt;

Thus have I heard…

### 5\. Lists

If there is an outline or formatted list in the introduction or ancillary materials, you may use MS Word’s built in feature for creating formatted lists. This is done by clicking on the list icons in the ribbon or it can be automatically generated by typing “\*” or “1.” into a new line. These generated lists may be used and will pass through the scripts and generate the proper markup for generating lists in the 84000 Reading Room.

If you don’t use the formatted lists and just use tab returns that is acceptable too, but markup will need to then produce the tags to generate the proper formatting in the Reading Room, so it will save them some time if you use MS Word’s built-in list formatting.

### 6\. Other Unusual Formatting

In some cases, the text may require unusual sections or formatting that don’t exactly fit into the sections provided in this template. If this happens, paste those sections of text as they appear and apply the styles as best you can. You can leave further notes to the markup editors in comments.

Occasionally, the translator will have applied indentation or other style changes to their regular text. This might show up in your style list with names like “Indentation” or “Endnote Text.” You don’t need to worry about this as it can be removed easily in the markup phase.

Please begin editing on the following page by pasting in the various titles of the text (leave the placeholder if that title is not applicable). Please delete these first nine pages of instructions (with Track Changes off) when you are finished with the copyediting phase of the document. You may wish to copy and paste these instructions into another document to reference while you are editing.

One last note: The styles in this template have all been set to Times New Roman and are based on the default paragraph font, which is set to 12 points. If the original document that you are pasting into the template has a different default paragraph font size or type, the fonts may change when you apply the various styles. However, you need not concern yourself with any of these changes; all of this formatting will be stripped away in the .xml document anyway, so it doesn’t matter what font you use or in what size they appear. However, if you find this distracting, you can change the default paragraph font in this template or from the original word document by going to menu: Format > Font, and then click on the “Default” button in the opened dialog window (this might be different in other versions of Word). You should be able to adjust the default here.

## G. Glossary

You may notice that the glossary table that was present in previous versions of the template has been removed from this version. Going forward, the glossaries will be processed online with a glossary builder. However, if you receive a project that contains a glossary table, it was likely started before the glossary builder was implemented. In this case, please paste the glossary tables in at the end of the document.

## H. Coversheet

Instructions for how to apply coversheets are forthcoming. For the time, if a project comes into the copyediting stage with a coversheet, simply paste that into the beginning of the document, otherwise please disregard any further details regarding the coversheet.
