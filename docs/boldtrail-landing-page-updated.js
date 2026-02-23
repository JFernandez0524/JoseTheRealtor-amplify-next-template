// UPDATED FORM SUBMISSION HANDLER FOR BOLDTRAIL LANDING PAGE
// Replace the existing $('.probateLeadForm').on('submit', ...) section with this:

$('.probateLeadForm').on('submit', function(e) {
    e.preventDefault();
    const $form = $(this);
    const areaId = $form.data('target');
    $('#analysis-overlay').css('display', 'flex');

    // Extract form data
    const name = $form.find('input[placeholder="Full Name"]').val();
    const email = $form.find('input[type="email"]').val();
    const phone = $form.find('input[type="tel"]').val();

    const payload = {
        street: addressData.street || $form.find('.autocomplete-address').val(),
        city: addressData.city || "",
        state: addressData.state || "NJ",
        zip: addressData.zip || "",
        lat: addressData.lat,
        lng: addressData.lng,
        address: addressData.address || $form.find('.autocomplete-address').val(),
        name: name,
        email: email,
        phone: phone
    };

    // Call the new BoldTrail lead endpoint
    fetch('https://leads.josetherealtor.com/api/v1/boldtrail-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
        $('#analysis-overlay').hide();
        
        if (data.success) {
            const zestimate = data.valuation?.zestimate || 0;
            const address = data.valuation?.address || payload.street;
            
            const html = `
                <div class="text-center py-5">
                    <h3 class="fw-bold text-success mb-3">Analysis Generated!</h3>
                    <p class="mb-2 lead">Estimated Value for ${address}:</p>
                    <div style="font-size: 3rem; font-weight: 900; color: #002b5b; margin-bottom: 25px;">
                        $${Number(zestimate).toLocaleString()}
                    </div>
                    ${data.property ? `
                        <div class="row g-3 mb-4 text-start" style="max-width: 500px; margin: 0 auto;">
                            <div class="col-6"><strong>Beds:</strong> ${data.property.beds || 'N/A'}</div>
                            <div class="col-6"><strong>Baths:</strong> ${data.property.baths || 'N/A'}</div>
                            <div class="col-6"><strong>Sq Ft:</strong> ${data.property.sqft?.toLocaleString() || 'N/A'}</div>
                            <div class="col-6"><strong>Year Built:</strong> ${data.property.yearBuilt || 'N/A'}</div>
                        </div>
                    ` : ''}
                    <p class="small text-muted mb-4">
                        We are preparing your comprehensive Probate Equity Report (PDF).<br>
                        Check your email shortly at <strong>${email}</strong>
                    </p>
                    <button onclick="location.reload()" class="btn btn-outline-secondary">Analyze Another Address</button>
                </div>`;
            $('#' + areaId).html(html);
        } else {
            throw new Error(data.error || 'Analysis failed');
        }
    })
    .catch((error) => {
        $('#analysis-overlay').hide();
        console.error('Analysis error:', error);
        alert("We received your request! Our team will manually calculate your property report and email it to you shortly.");
    });
});
