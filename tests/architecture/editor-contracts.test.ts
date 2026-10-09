import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CreateCameraControllerPorts } from '../../src/presentation/viewport/camera-controller.ports';
import type { CameraState } from '../../src/presentation/viewport/camera-types';

// These checks fail compilation if a future change makes the dependency boundary unrestricted.
function verifyCameraBoundary(ports: CreateCameraControllerPorts, state: CameraState) {
  // @ts-expect-error Camera code has no command or persistence access.
  ports.commands;
  // @ts-expect-error Consumers cannot replace another module's behavior.
  ports.inspector.inside = () => true;
  // @ts-expect-error Camera distances are numeric state.
  state.dist = 'far';
}
test('camera dependency and state contracts remain narrow', () => {
  assert.equal(typeof verifyCameraBoundary, 'function');
});
