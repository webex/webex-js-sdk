class IMIMessageMediaView extends HTMLElement {
    constructor() {
        super();
        this.loadMessage();
    }
    message;
    isRendered = false;
    loadMessage() {
        let messageAttributeValue = this.getAttribute('message');
        let decodedMessageAttributeValue = decodeURIComponent(messageAttributeValue);
        let jsonStringForMessageAttributeValue = JSON.parse(decodedMessageAttributeValue);
        let icMessage = IMI.ICMessage.fromJSON(jsonStringForMessageAttributeValue);
        this.message = icMessage;
    }
    connectedCallback() {

        if (this.isRendered) return;
        else if (this.message && this.message.getAttachments() && this.message.getAttachments().length > 0) {
            this.isRendered = true;
            this.renderMessageMedia();
        }
    }
    renderPendingForm(form) {
        let html = '';
        html += `<label class='title'>${form.getTitle()}</label>
        <div class='error' style='display:none'></div>`;
        form.getFields().map((field) => {
            let fieldHTML = "";
            fieldHTML += `<label>${field.getLabel()}${field.getMandatory() ? "*" : ""
                }</label>`;
            switch (field.getType()) {
                case IMI.ICFormFieldType.Dropdown:
                    if (field.getMandatory())
                        fieldHTML += `<select  isMandatory=true name="${field.getLabel()}">`
                    else fieldHTML += `<select  name="${field.getLabel()}">`
                    field.options.forEach(option => fieldHTML += `<option> ${option}</option>`);
                    fieldHTML += `</select>`;
                    break;
                case IMI.ICFormFieldType.MultiSelectDropdown:
                    if (field.getMandatory())
                        fieldHTML += `<select multiple isMandatory=true name="${field.getLabel()}">`
                    else fieldHTML += `<select multiple name="${field.getLabel()}">`
                    field.options.forEach(option => fieldHTML += `<option> ${option}</option>`);
                    fieldHTML += `</select>`;
                    break;
                default:
                    if (field.getMandatory())
                        fieldHTML += `<input type='text' isMandatory name="${field.getLabel()}">`;
                    else
                        fieldHTML += `<input type='text' name="${field.getLabel()}">`;
                    break;
            }
            html += `<div class='field'> ${fieldHTML} </div>`;
        });
        html += `<input type='button' value='Submit Response' class='button-primary' />`; //nopes
        html = `<div class="form">${html}</div>`;
        this.innerHTML += `<div class="media">${html}</div>`;
        let submitButton = this.querySelector('.button-primary');
        if (submitButton) submitButton.onclick = (ev) => this.submitFormResponse(ev);
        this.error = this.querySelector('.error');
        return html;
    }
    renderCompletedFormMT(form) {
        let html = "";
        html += `<label class='title'>${this.message.getAttachments()[0].getTitle()}</label>`;
        this.message.getInteractiveData().payload.fields.forEach((f) => {
            html += `<div class='field'>  ${f.name}:${f.value}</div > `;
        });
        html = `<div class="form"> ${html}</div>`;
        this.innerHTML += `<div class="media">${html}</div > `;
    }
    renderSubmittedForm() {
        let html = "";
        html += `<label class='title'>${form.getTitle()}</label>`;
        form.getFields().map((field) => {
            let fieldHTML = "";
            fieldHTML += `<span>${field.getLabel()}${field.getMandatory() ? "*" : ""
                }</span>: <span>${field.getValue()}</span>`;

            html += `<div class='field'> ${fieldHTML} </div>`;
        });
        html = `<div class="form">${html}</div>`;
        this.innerHTML += `<div class="media">${html}</div>`;

    }



    renderMessageMedia() {
        this.message.getAttachments().forEach(mediaItem => {
            if (!mediaItem) return;

            let html = "";
            switch (mediaItem.getContentType()) {
                case IMI.ICContentType.Template:
                    switch (mediaItem.getTemplateType()) {
                        case IMI.ICTemplateType.Form:
                            if (this.message.getInteractiveData())
                                this.renderCompletedFormMT();
                            else if (this.message.getRelatedTransactionId()) {
                                this.innerHTML += "You have submitted the form";
                                break;
                            }
                            else this.renderPendingForm(mediaItem);
                            break;
                        case IMI.ICTemplateType.Generic:
                            this.renderGenericTemplate(mediaItem);
                            break;
                        default:
                            console.log(`Template ${mediaItem.getTemplateType()} not supported`);
                            break;
                    }
                    break;
                case IMI.ICContentType.Image:
                    html += `<a href="${mediaItem.getURL()}" target="_blank"><img src="data:image/png;base64,${mediaItem.getPreview()}" width="100" /></a>`;
                    this.innerHTML += `<div class="media" > ${html}</div > `;
                    break;
                default:
                    html += `<a href="${mediaItem.getURL()}" target="_blank">${getDisplayFileName(mediaItem.getURL())}</a>`;
                    this.innerHTML += `<div class="media" > ${html}</div > `;
                    break;
            }
        })
    }
    displayInvalidForm(errors) {
        IMIToast.show("Message not sent, please check for errors");
        this.error.style.display = 'block';
        this.error.innerHTML = "Please provide below inputs:<br>";
        this.error.innerHTML += errors.join('<br>');
    }

    submitFormResponse(ev) {
        this.querySelector('.error').innerHTML = '';
        let a = ev.target.parentElement;
        let formInputs = Array.from(a.querySelectorAll('input:not(input[type=button])'));
        let formData = {};
        formInputs.forEach(bi => {
            formData[bi.name] = bi.value;
        });
        let formDropdowns = Array.from(a.querySelectorAll('select'));
        formDropdowns.forEach(ci => {
            formData[ci.name] = Array.from(ci.selectedOptions).map(ci => ci.value);
        });
        var errors = [];
        this.message.getAttachments()[0].getFields().map((field) => {

            field.setValue(formData[field.getLabel()]);
            if (field.getMandatory()) {
                switch (field.getType()) {
                    case IMI.ICFormFieldType.Text:
                    case IMI.ICFormFieldType.Name:
                    case IMI.ICFormFieldType.Email:
                        if (!field.value || field.value.trim().length == 0)
                            errors.push(`Enter ${field.getLabel()} `);
                        break;
                    case IMI.ICFormFieldType.Dropdown:
                    case IMI.ICFormFieldType.MultiSelectDropdown:
                        if (!field.value || !field.value.length > 0)
                            errors.push(`Select ${field.getLabel()} `);
                        break;
                    case IMI.ICFormFieldType.Email:
                        if (!field.value || field.value.trim().length == 0 || !validateEmail(field.value))
                            errors.push(`Enter proper ${field.getLabel()}`);
                        break;
                    case IMI.ICFormFieldType.Integer:
                        if (!field.value)
                            errors.push(`Enter a numeric value for ${field.getLabel()}`);
                        break;
                    case IMI.ICFormFieldType.Decimal:
                        if (!field.value)
                            errors.push(`Enter a numeric value for ${field.getLabel()}`);
                        break;
                    case IMI.ICFormFieldType.Date:
                        if (!field.value || field.value.trim().length == 0)
                            errors.push(`Enter date value for ${field.getLabel()}`);
                        break;
                    default:
                        break;
                }
            }
        });
        if (errors.length > 0) this.displayInvalidForm(errors);
        else {
            console.log(' this.message.getAttachments()[0].getFields(): ', this.message.getAttachments()[0].getFields());
            this.error.style.display = 'none';
            this.disableFormInputs();
            let ev = new CustomEvent("onsubmit", { detail: this.message });
            this.dispatchEvent(ev);
        }
    }
    disableFormInputs() {
        this.querySelectorAll('input, select').forEach(el => el.disabled = true);
    }
    toggleMoreButtonPopup(ev) {
        ev.target.closest('.element-container').querySelector('.element-popup').style.display =
            ev.target.closest('.element-container').querySelector('.element-popup').style.display == 'none' ? 'block' : 'none';
    }

    renderGenericTemplate(template) {
        let html = '';
        let elementHtml = ``;
        template.getElements().forEach(element => {
            let buttonHtml = `
            <div class="element-buttons">` +
                `<input type="button" value="${element.getButtons()[0].getTitle()}"
                        data-icbutton='${JSON.stringify(element.getButtons()[0].toJSON())}' />
                &nbsp;`;
            if (element.getButtons().length > 1)
                buttonHtml += `<span name="btnMore">  <imi-svg-icon src="/assets/icons/ellipsis-vertical.svg"></imi-svg-icon></span>`;
            buttonHtml += `</div>`;
            if (element.getButtons().length > 1) {
                buttonHtml += `<div class="element-popup" style='display:none'>`;
                element.getButtons().forEach(btn => {
                    buttonHtml += `<div class="item"
                    data-icbutton='${JSON.stringify(btn.toJSON())}' ><label
                    title="${btn.getTitle()}"
                    >${btn.getTitle()}</label></div>`;
                })
                buttonHtml += `</div>`;
            }
            elementHtml += `
            <div class="element-container">
                <div class="element"
                data-element='${JSON.stringify(element.toJSON())}'
                 style="background-image:url(${element.getImageURLs()[0]})">
                    <div class="element-image">&nbsp;</div>
                    <div class="element-title">${element.getTitle()}</div>
                    <div class="element-desc">${element.getSubtitle()}</div>
                </div>
                ${buttonHtml}
            </div>`;

        });
        html = `<div class="template-scroller">${elementHtml}</div>`;
        html = `<div class="template-container">${html}</div>`;
        this.innerHTML += `<div class="media">${html}</div>`;

        let detailButtons = this.querySelectorAll('.element');
        detailButtons.forEach(btn => btn.onclick = (ev) => { this.toggleElementDetailPage(ev.target); });

        let clickButtons = this.querySelectorAll('.item');
        clickButtons.forEach(btn => btn.onclick = (ev) => { this.toggleMoreButtonPopup(ev); this.submitClickPostback(ev) });

        let moreBtns = this.querySelectorAll('span[name=btnMore]');
        moreBtns.forEach(btn => btn.onclick = (ev) => this.toggleMoreButtonPopup(ev));

        let defaulBtns = this.querySelectorAll('input[type=button]');
        defaulBtns.forEach(btn => btn.onclick = (ev) => this.submitClickPostback(ev));
    }
    submitClickPostback(ev) {
        console.log("submitClickPostback", ev);
        let icButtonJSON = ev.target.getAttribute('data-icbutton');
        let icButton = new IMI.ICButton(JSON.parse(icButtonJSON));
        let onclickpostback = new CustomEvent("onclickpostback", { detail: { icButton: icButton, message: this.message } });
        this.dispatchEvent(onclickpostback);
    }
    toggleElementDetailPage(target) {
        let divElementDetail = document.querySelector('.element-detail');
        if (divElementDetail) divElementDetail.parentElement.removeChild(divElementDetail);

        if (!target) return;
        let element = new IMI.ICGenericTemplateElement(JSON.parse(target.getAttribute("data-element")))

        let html = '';
        html += `<div class="element-detail">
     <div class="element-header">
         <span class="close-button" >
             <imi-svg-icon src="/assets/icons/close.svg"></imi-svg-icon>&nbsp;
         </span>
         <div class="element-detail-title">${element.getTitle()}
         </div>
     </div>
     <div class="element-image-container">
         <div class="element-image-scroller">
          `;
        element.getImageURLs().forEach(img => {
            html += ` <div class="element-image">
                 <img
                     src="${img}">
             </div>
             `});
        html += `
         </div>
     </div>

     <div class="element-description">
     ${element.getSubtitle()}
     </div>`;
        element.getButtons().forEach(btn => {
            html += `<div class="element-detail-buttons">
     <input type="button" value="${btn.getTitle()}" onclick="IMIToast.show('${btn.getTitle()} Clicked!')">
 </div>`    ;
        })
        html += `
 </div >
 </div > `;
        this.parentElement.innerHTML += html;
        document.querySelector('.close-button').onclick = (ev) => { this.toggleElementDetailPage(); };
    }
}
customElements.define('imi-message-media-view', IMIMessageMediaView);



