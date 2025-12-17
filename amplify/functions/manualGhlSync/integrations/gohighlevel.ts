import axios from 'axios';
import { DBLead } from '../../../../app/utils/aws/data/lead.server';

const GHL_CUSTOM_FIELD_ID_MAP: Record<string, string> = {
  mailing_address: '2RCYsC2cztJ1TWTh0tLt',
  mailing_city: '2F48dc4QEAOFHNgBNVcu',
  mailing_state: 'WzTPYXsXyPcnFSWn2UFf',
  mailing_zipcode: 'Vx4EIVAsIK3ej5jEv3Bm',
  property_address: 'p3NOYiInAERYbe0VsLHB',
  property_city: 'h4UIjKQvFu7oRW4SAY8W',
  property_state: '9r9OpQaxYPxqbA6Hvtx7',
  property_zip: 'hgbjsTVwcyID7umdhm2o',
  lead_source_id: 'PBInTgsd2nMCD3Ngmy0a',
  type: '3zHY47rcT4o2PXNAfLul',
  lead_type: 'oaf4wCuM3Ub9eGpiddrO',
  skiptracestatus: 'HrnY1GUZ7P6d6r7J0ZRc',
  phone_2: 'LkmfM0Va5PylJFsJYjCu',
  phone_3: 'Cu6zwsuWrxoVWdxySc6t',
  phone_4: 'hxwJG0lYeV18IxxWh09H',
  phone_5: '8fIoSV1W05ciIrn01QT0',
  email_2: 'JY5nf3NzRwfCGvN5u00E',
  email_3: '1oy6TLKItn5RkebjI7kD',
};

const GHL_API_KEY = process.env.GHL_API_KEY;

export async function syncToGoHighLevel(lead: DBLead): Promise<string> {
  if (!GHL_API_KEY) throw new Error('GHL_API_KEY Missing');

  try {
    let firstName = lead.ownerFirstName || 'Unknown';
    let lastName = lead.ownerLastName || 'Owner';

    if (lead.type?.toUpperCase() === 'PROBATE') {
      firstName = lead.adminFirstName || firstName;
      lastName = lead.adminLastName || lastName;
    }

    const primaryEmail =
      lead.emails && lead.emails.length > 0
        ? lead.emails[0]
        : `no-email-${Date.now()}@example.com`;
    const primaryPhone =
      lead.phones && lead.phones.length > 0 ? lead.phones[0] : null;

    // 🟢 Prospecting Tags (Not including Lead Type)
    const tags = ['Start Dialing Campaign'];
    if (lead.leadLabels && Array.isArray(lead.leadLabels)) {
      lead.leadLabels.forEach((label) => {
        if (label && !tags.includes(label.replace(/_/g, ' '))) {
          tags.push(label.replace(/_/g, ' '));
        }
      });
    }

    // 💥 NORMALIZATION: Match GHL Dropdown Casing exactly for selection
    let normalizedLeadType = lead.type || '';
    if (normalizedLeadType.toUpperCase() === 'PREFORECLOSURE') {
      normalizedLeadType = 'Preforeclosure';
    } else if (normalizedLeadType.toUpperCase() === 'PROBATE') {
      normalizedLeadType = 'Probate';
    }

    const customFieldsMap: Record<string, any> = {
      mailing_address: lead.mailingAddress || '',
      mailing_city: lead.mailingCity || '',
      mailing_state: lead.mailingState || '',
      mailing_zipcode: lead.mailingZip || '',
      property_address: lead.ownerAddress || '',
      property_city: lead.ownerCity || '',
      property_state: lead.ownerState || '',
      property_zip: lead.ownerZip || '',
      lead_source_id: lead.id,
      lead_type: normalizedLeadType, // 👈 Correct string for dropdown match
      skiptracestatus: lead.skipTraceStatus,
      phone_2: lead.phones?.[1] || '',
      phone_3: lead.phones?.[2] || '',
      phone_4: lead.phones?.[3] || '',
      phone_5: lead.phones?.[4] || '',
      email_2: lead.emails?.[1] || '',
      email_3: lead.emails?.[2] || '',
    };

    const ghlCustomFields = Object.keys(customFieldsMap)
      .filter(
        (key) =>
          customFieldsMap[key] !== '' &&
          customFieldsMap[key] !== null &&
          GHL_CUSTOM_FIELD_ID_MAP[key]
      )
      .map((key) => ({
        id: GHL_CUSTOM_FIELD_ID_MAP[key],
        field_value: customFieldsMap[key],
      }));

    const payload: any = {
      locationId: 'mHaAy3ZaUHgrbPyughDG',
      firstName,
      lastName,
      email: primaryEmail,
      phone: primaryPhone,
      country: 'US',
      source: 'JTR_SkipTrace_App',
      tags,
      dnd: false,
      customFields: ghlCustomFields,
    };

    if (!payload.phone) delete payload.phone;

    const res = await axios.post(
      'https://services.leadconnectorhq.com/contacts',
      payload,
      {
        headers: {
          Authorization: `Bearer ${GHL_API_KEY}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Version: '2021-07-28',
        },
      }
    );

    return res.data?.contact?.id;
  } catch (error: any) {
    const serverMsg =
      error.response?.data?.message || JSON.stringify(error.response?.data);
    throw new Error(
      `GHL sync failed (Status ${error.response?.status}): ${serverMsg}`
    );
  }
}
