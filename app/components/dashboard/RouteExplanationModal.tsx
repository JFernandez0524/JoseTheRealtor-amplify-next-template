'use client';

interface RouteExplanationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  leadType: 'PROBATE' | 'PREFORECLOSURE';
  leadCount: number;
}

export function RouteExplanationModal({
  isOpen,
  onClose,
  onConfirm,
  leadType,
  leadCount,
}: RouteExplanationModalProps) {
  if (!isOpen) return null;

  const isProbate = leadType === 'PROBATE';
  const costPerLead = isProbate ? 0.10 : 0.35;
  const totalCost = (leadCount * costPerLead).toFixed(2);

  const routeInfo = isProbate
    ? {
        title: 'Skip Trace',
        cost: '$0.10/lead',
        description: 'Phone & email lookup',
        features: [
          'Find contact phone numbers',
          'Discover email addresses',
          'Mailing address information',
          'Basic contact data',
        ],
      }
    : {
        title: 'Property Enrichment',
        cost: '$0.35/lead',
        description: 'Complete property data + contacts',
        features: [
          'Real equity percentage & mortgage balances',
          'Owner emails & quality phone numbers (mobile, score 90+, not DNC)',
          'Property flags (owner occupied, high equity, free & clear)',
          'Foreclosure details & lender information',
        ],
      };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 shadow-xl">
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {routeInfo.title}
            </h2>
            <p className="text-sm text-gray-600">{routeInfo.description}</p>
          </div>

          {/* Cost Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Cost per lead:</span>
              <span className="text-lg font-bold text-blue-600">{routeInfo.cost}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">
                Total for {leadCount} lead{leadCount !== 1 ? 's' : ''}:
              </span>
              <span className="text-xl font-bold text-blue-600">${totalCost}</span>
            </div>
          </div>

          {/* Features */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">What you'll get:</h3>
            <ul className="space-y-2">
              {routeInfo.features.map((feature, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
            >
              Confirm ${totalCost}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
