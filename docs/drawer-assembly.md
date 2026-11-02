# Drawer installation in Assembly Studio

The modeled drawer is a wooden box on generic side-mounted telescopic runners. The existing box sizes and 12.5 mm side space are retained. This is a mechanism illustration, not a branded runner drilling template, soft-close certification or a load-rated hardware selection.

The film has five drawer chapters: build the box outside the cabinet; mount the cabinet and removable drawer members with short screws; engage both sides and insert the box; attach the decorative front from inside; open and close each drawer individually. Cabinet sides become translucent for the travel demonstration. Open drawer and Close drawer animate to a paused endpoint; reduced-motion users get the endpoint directly. Scrubbing and reverse playback produce the same transforms.

Each pair records both cabinet sides and both drawer sides. The outside rails remain on the cabinet, the intermediate members extend at half the drawer displacement, and the inner members follow the moving box. Nested channels, bearing-cage rollers and release levers illustrate the parts. The movement is schematic; actual intermediate-member travel can depend on the runner's synchronization design.

Runner screws are modeled as 4 × 12 mm with 2.5 mm pilot holes and enter from the accessible faces. Front screws are 4 × 30 mm from the box's inside front panel into its decorative front. Structural connectors continue to join fixed cabinet panels and drawer-box corners; they never connect a moving box directly to the cabinet. The modeled surface-mounted 6 mm drawer bottom is fixed upwards from underneath, independently of the selected cabinet-back system.

The installation sequence follows the separation, cabinet-member mounting, drawer-member mounting and reinsertion described in [Accuride's installation guide](https://help.accuride-europe.com/knowledge/installing-drawer-slides). Actual clearances, hole patterns, screws and travel must come from the selected hardware's instructions; for example, the [Accuride 3832EC instructions](https://www.accuride.com/media/amasty/amfile/attach/d4ba99d10b86f194bef3fdc51f9ccb24.pdf) specify 12.7 mm minimum side space, so this generic model must not be presented as that product.

Regression coverage: assembly order, fastener ownership and penetration, front attachment, rigid box insertion, separate drawers, stationary/moving rail hosts, deterministic reverse playback, and runner visibility before installation.
